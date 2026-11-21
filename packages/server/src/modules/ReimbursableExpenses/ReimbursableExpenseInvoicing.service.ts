import { Inject, Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import { pick } from 'lodash';
import * as moment from 'moment';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import { Expense } from '@/modules/Expenses/models/Expense.model';
import { SaleInvoice } from '@/modules/SaleInvoices/models/SaleInvoice';
import { Customer } from '@/modules/Customers/models/Customer';
import { Item } from '@/modules/Items/models/Item';
import { ItemEntry } from '@/modules/TransactionItemEntry/models/ItemEntry';
import { Account } from '@/modules/Accounts/models/Account.model';
import { EditSaleInvoice } from '@/modules/SaleInvoices/commands/EditSaleInvoice.service';
import { EditSaleInvoiceDto } from '@/modules/SaleInvoices/dtos/SaleInvoice.dto';
import { CreateItemService } from '@/modules/Items/CreateItem.service';
import { CreateAccountService } from '@/modules/Accounts/CreateAccount.service';
import { ACCOUNT_TYPE } from '@/constants/accounts';
import { ServiceError } from '@/modules/Items/ServiceError';
import {
  ERRORS,
  REIMBURSABLE_ITEM_NAME,
  REIMBURSED_INCOME_ACCOUNT_NAME,
} from './constants';

type ItemEntryWithBatches = ItemEntry & {
  batches?: Array<{ batchId: number; quantity: number | string }>;
};

/**
 * Retrieves the file keys of the given attached documents.
 */
const getDocumentKeys = (documents?: unknown[]): string[] =>
  (documents || []).map((doc) => (doc as { key: string }).key);

/**
 * Bills reimbursable expenses to customers: validates the reimbursement link
 * and adds the expense to an invoice as a line item with its receipt attached.
 */
@Injectable()
export class ReimbursableExpenseInvoicing {
  constructor(
    private readonly editSaleInvoiceService: EditSaleInvoice,
    private readonly createItemService: CreateItemService,
    private readonly createAccountService: CreateAccountService,

    @Inject(Expense.name)
    private readonly expenseModel: TenantModelProxy<typeof Expense>,

    @Inject(SaleInvoice.name)
    private readonly saleInvoiceModel: TenantModelProxy<typeof SaleInvoice>,

    @Inject(Customer.name)
    private readonly customerModel: TenantModelProxy<typeof Customer>,

    @Inject(Item.name)
    private readonly itemModel: TenantModelProxy<typeof Item>,

    @Inject(Account.name)
    private readonly accountModel: TenantModelProxy<typeof Account>,
  ) {}

  /**
   * Validates the customer and invoice an expense is reimbursed by.
   * @param {object} dto - Expense reimbursement fields.
   * @param {Knex.Transaction} trx
   */
  public async validateReimbursement(
    dto: {
      reimbursable?: boolean;
      reimburseCustomerId?: number | null;
      reimburseInvoiceId?: number | null;
    },
    trx?: Knex.Transaction,
  ): Promise<void> {
    const { reimbursable, reimburseCustomerId, reimburseInvoiceId } = dto;

    if (!reimburseCustomerId && !reimburseInvoiceId) return;

    if (!reimbursable) {
      throw new ServiceError(
        ERRORS.REIMBURSE_REQUIRES_REIMBURSABLE,
        'Mark the expense as reimbursable to link it to a customer or invoice.',
      );
    }
    if (reimburseCustomerId) {
      const customer = await this.customerModel()
        .query(trx)
        .findById(reimburseCustomerId);

      if (!customer) {
        throw new ServiceError(
          ERRORS.REIMBURSE_CUSTOMER_NOT_FOUND,
          'The customer or job was not found.',
        );
      }
    }
    if (reimburseInvoiceId) {
      const invoice = await this.saleInvoiceModel()
        .query(trx)
        .findById(reimburseInvoiceId);

      if (!invoice) {
        throw new ServiceError(
          ERRORS.REIMBURSE_INVOICE_NOT_FOUND,
          'The invoice was not found.',
        );
      }
      if (reimburseCustomerId && invoice.customerId !== reimburseCustomerId) {
        throw new ServiceError(
          ERRORS.REIMBURSE_INVOICE_CUSTOMER_MISMATCH,
          'The invoice belongs to another customer.',
        );
      }
      if (invoice.writtenoffAt) {
        throw new ServiceError(
          ERRORS.REIMBURSE_INVOICE_WRITTEN_OFF,
          'The invoice was written off and cannot take new lines.',
        );
      }
    }
  }

  /**
   * Adds the given expense to the given invoice as a line item and attaches
   * the expense receipts to the invoice.
   * @param {number} expenseId - Expense id.
   * @param {number} invoiceId - Sale invoice id.
   * @param {Knex.Transaction} trx
   * @param {string[]} receiptKeys - Receipt file keys not linked to the expense yet.
   */
  public async addExpenseToInvoice(
    expenseId: number,
    invoiceId: number,
    trx?: Knex.Transaction,
    receiptKeys: string[] = [],
  ): Promise<SaleInvoice> {
    const expense = await this.expenseModel()
      .query(trx)
      .findById(expenseId)
      .withGraphFetched('attachments')
      .throwIfNotFound();

    const invoice = await this.saleInvoiceModel()
      .query(trx)
      .findById(invoiceId)
      .withGraphFetched('entries.batches')
      .withGraphFetched('attachments')
      .throwIfNotFound();

    // Created in its own transaction: the invoice validators read items
    // outside of the expense transaction.
    const itemId = await this.getOrCreateReimbursableItem();
    const existingEntries = [...(invoice.entries || [])].sort(
      (a, b) => a.index - b.index,
    );
    const entries = existingEntries.map(
      (entry: ItemEntryWithBatches, position) => ({
        ...pick(entry, [
          'itemId',
          'rate',
          'quantity',
          'discount',
          'discountType',
          'description',
          'taxRateId',
          'warehouseId',
        ]),
        index: position + 1,
        ...(entry.batches?.length
          ? {
              batches: entry.batches.map((batch) => ({
                batchId: batch.batchId,
                quantity: Number(batch.quantity),
              })),
            }
          : entry.batchId
            ? { batchId: entry.batchId }
            : {}),
      }),
    );
    entries.push({
      itemId,
      index: entries.length + 1,
      rate: expense.totalAmount,
      quantity: 1,
      description: this.getLineDescription(expense),
    } as any);

    const attachmentKeys = new Set<string>([
      ...getDocumentKeys(invoice.attachments),
      ...getDocumentKeys(expense.attachments),
      ...receiptKeys,
    ]);
    const invoiceDTO = {
      customerId: invoice.customerId,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      invoiceNo: invoice.invoiceNo,
      referenceNo: invoice.referenceNo,
      invoiceMessage: (invoice as any).invoiceMessage,
      termsConditions: (invoice as any).termsConditions,
      exchangeRate: invoice.exchangeRate,
      warehouseId: invoice.warehouseId,
      branchId: invoice.branchId,
      isInclusiveTax: invoice.isInclusiveTax,
      pdfTemplateId: invoice.pdfTemplateId,
      discount: invoice.discount,
      discountType: invoice.discountType,
      adjustment: invoice.adjustment,
      delivered: !!invoice.deliveredAt,
      entries,
      attachments: [...attachmentKeys].map((key) => ({ key })),
    } as EditSaleInvoiceDto;

    const saleInvoice = await this.editSaleInvoiceService.editSaleInvoice(
      invoiceId,
      invoiceDTO,
      trx,
    );
    await this.expenseModel().query(trx).findById(expenseId).patch({
      reimburseInvoiceId: invoiceId,
      reimburseCustomerId: invoice.customerId,
      reimbursable: true,
      invoicedAmount: expense.totalAmount,
    });
    return saleInvoice;
  }

  /**
   * Retrieves the invoice line description of the given expense.
   * @param {Expense} expense
   * @returns {string}
   */
  private getLineDescription(expense: Expense): string {
    const date = moment(expense.paymentDate).format('MMM D, YYYY');
    const note = expense.description?.trim();
    return note
      ? `Reimbursable expense: ${note} (${date})`
      : `Reimbursable expense (${date})`;
  }

  /**
   * Retrieves the service item used for reimbursable expense lines, creating
   * it with its income account the first time.
   * @param {Knex.Transaction} trx
   * @returns {Promise<number>} The item id.
   */
  private async getOrCreateReimbursableItem(
    trx?: Knex.Transaction,
  ): Promise<number> {
    const foundItem = await this.itemModel()
      .query(trx)
      .findOne('name', REIMBURSABLE_ITEM_NAME);

    if (foundItem) return foundItem.id;

    const sellAccountId = await this.getOrCreateIncomeAccount(trx);

    return this.createItemService.createItem(
      {
        name: REIMBURSABLE_ITEM_NAME,
        type: 'service',
        sellable: true,
        purchasable: false,
        sellAccountId,
        sellDescription: 'Expenses billed back to the customer',
        active: true,
      },
      trx,
    );
  }

  /**
   * Retrieves the income account reimbursements are credited to, creating it
   * the first time.
   * @param {Knex.Transaction} trx
   * @returns {Promise<number>} The account id.
   */
  private async getOrCreateIncomeAccount(
    trx?: Knex.Transaction,
  ): Promise<number> {
    const foundAccount = await this.accountModel()
      .query(trx)
      .findOne('name', REIMBURSED_INCOME_ACCOUNT_NAME);

    if (foundAccount) return foundAccount.id;

    const account = await this.createAccountService.createAccount(
      {
        name: REIMBURSED_INCOME_ACCOUNT_NAME,
        accountType: ACCOUNT_TYPE.OTHER_INCOME,
        description: 'Customer payments for expenses billed back to them',
      },
      trx,
    );
    return account.id;
  }
}
