import { Inject, Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import * as moment from 'moment';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import { ServiceError } from '@/modules/Items/ServiceError';
import { UnitOfWork } from '@/modules/Tenancy/TenancyDB/UnitOfWork.service';
import { Expense } from '@/modules/Expenses/models/Expense.model';
import { Item } from '@/modules/Items/models/Item';
import { Account } from '@/modules/Accounts/models/Account.model';
import { CreateItemService } from '@/modules/Items/CreateItem.service';
import { CreateSaleInvoice } from '@/modules/SaleInvoices/commands/CreateSaleInvoice.service';
import { CreateSaleInvoiceDto } from '@/modules/SaleInvoices/dtos/SaleInvoice.dto';
import { ReimbursableExpenseInvoicing } from '@/modules/ReimbursableExpenses/ReimbursableExpenseInvoicing.service';
import { JobLaborEntry } from './models/JobLaborEntry.model';
import { JobsService } from './Jobs.service';
import {
  ERRORS,
  LABOR_INCOME_ACCOUNT_SLUG,
  LABOR_ITEM_NAME,
} from './constants';
import { buildLaborInvoiceLines } from './utils';

/**
 * Builds one draft invoice for a job's unbilled labor and expenses.
 */
@Injectable()
export class JobInvoicing {
  constructor(
    private readonly jobsService: JobsService,
    private readonly createSaleInvoiceService: CreateSaleInvoice,
    private readonly createItemService: CreateItemService,
    private readonly reimbursableInvoicing: ReimbursableExpenseInvoicing,
    private readonly uow: UnitOfWork,

    @Inject(JobLaborEntry.name)
    private readonly laborModel: TenantModelProxy<typeof JobLaborEntry>,

    @Inject(Expense.name)
    private readonly expenseModel: TenantModelProxy<typeof Expense>,

    @Inject(Item.name)
    private readonly itemModel: TenantModelProxy<typeof Item>,

    @Inject(Account.name)
    private readonly accountModel: TenantModelProxy<typeof Account>,
  ) {}

  /**
   * Creates a draft invoice for the job's unbilled labor and reimbursable
   * expenses, attaches the receipts and marks everything as billed.
   * @param {number} jobId
   * @returns {Promise<{ invoiceId: number }>}
   */
  public async invoiceJob(jobId: number): Promise<{ invoiceId: number }> {
    const job = await this.jobsService.getJobOrThrow(jobId);

    const [labor, expenses] = await Promise.all([
      this.laborModel()
        .query()
        .where('projectId', jobId)
        .whereNull('invoiceId')
        .orderBy('date'),
      this.expenseModel()
        .query()
        .where('projectId', jobId)
        .where('reimbursable', true)
        .whereNull('reimburseInvoiceId')
        .whereNotNull('publishedAt')
        .withGraphFetched('attachments')
        .orderBy('paymentDate'),
    ]);
    const laborLines = buildLaborInvoiceLines(labor).filter(
      (line) => line.quantity * line.rate > 0,
    );
    const billableExpenses = expenses.filter(
      (expense) => Number(expense.totalAmount) > 0,
    );
    if (laborLines.length === 0 && billableExpenses.length === 0) {
      throw new ServiceError(
        ERRORS.JOB_NOTHING_TO_INVOICE,
        'This job has no unbilled labor or expenses.',
      );
    }
    // Created in their own transactions: the invoice validators read items
    // outside of the invoice transaction.
    const laborItemId =
      laborLines.length > 0 ? await this.getOrCreateLaborItem() : null;
    const expenseItemId =
      billableExpenses.length > 0
        ? await this.reimbursableInvoicing.getOrCreateReimbursableItem()
        : null;

    const entries = [
      ...laborLines.map((line) => ({
        itemId: laborItemId,
        rate: line.rate,
        quantity: line.quantity,
        description: line.description,
      })),
      ...billableExpenses.map((expense) => ({
        itemId: expenseItemId,
        rate: Number(expense.totalAmount),
        quantity: 1,
        description: this.reimbursableInvoicing.getLineDescription(expense),
      })),
    ].map((entry, index) => ({ ...entry, index: index + 1 }));

    const attachmentKeys = [
      ...new Set(
        billableExpenses.flatMap((expense) =>
          (expense.attachments || []).map(
            (doc) => (doc as unknown as { key: string }).key,
          ),
        ),
      ),
    ];
    const today = moment().format('YYYY-MM-DD');
    const invoiceDTO = {
      customerId: job.contactId,
      invoiceDate: today,
      dueDate: moment().add(30, 'days').format('YYYY-MM-DD'),
      referenceNo: job.name.slice(0, 255),
      delivered: false,
      entries,
      attachments: attachmentKeys.map((key) => ({ key })),
    } as unknown as CreateSaleInvoiceDto;

    return this.uow.withTransaction(async (trx: Knex.Transaction) => {
      const invoice = await this.createSaleInvoiceService.createSaleInvoice(
        invoiceDTO,
        trx,
      );
      if (labor.length > 0) {
        await this.laborModel()
          .query(trx)
          .whereIn(
            'id',
            labor.map((entry) => entry.id),
          )
          .patch({ invoiceId: invoice.id });
      }
      for (const expense of billableExpenses) {
        await this.expenseModel().query(trx).findById(expense.id).patch({
          reimburseInvoiceId: invoice.id,
          reimburseCustomerId: job.contactId,
          invoicedAmount: expense.totalAmount,
        });
      }
      return { invoiceId: invoice.id };
    });
  }

  /**
   * Releases the labor and expenses billed on a deleted invoice so they can be
   * billed again.
   * @param {number} invoiceId
   * @param {Knex.Transaction} trx
   */
  public async releaseInvoice(invoiceId: number, trx?: Knex.Transaction) {
    await this.laborModel()
      .query(trx)
      .where('invoiceId', invoiceId)
      .patch({ invoiceId: null });
    await this.expenseModel()
      .query(trx)
      .where('reimburseInvoiceId', invoiceId)
      .patch({ reimburseInvoiceId: null, invoicedAmount: 0 });
  }

  /**
   * Retrieves the service item labor lines are billed with, creating it the
   * first time.
   */
  private async getOrCreateLaborItem(): Promise<number> {
    const foundItem = await this.itemModel()
      .query()
      .findOne('name', LABOR_ITEM_NAME);
    if (foundItem) return foundItem.id;

    const incomeAccount =
      (await this.accountModel()
        .query()
        .findOne('slug', LABOR_INCOME_ACCOUNT_SLUG)) ||
      (await this.accountModel()
        .query()
        .whereIn('accountType', ['income'])
        .first());

    return this.createItemService.createItem({
      name: LABOR_ITEM_NAME,
      type: 'service',
      sellable: true,
      purchasable: false,
      sellAccountId: incomeAccount?.id,
      sellDescription: 'Billable labor',
      active: true,
    });
  }
}
