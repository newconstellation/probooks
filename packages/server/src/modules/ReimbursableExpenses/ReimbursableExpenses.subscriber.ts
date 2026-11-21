import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { events } from '@/common/events/events';
import {
  IExpenseCreatedPayload,
  IExpenseCreatingPayload,
} from '@/modules/Expenses/interfaces/Expenses.interface';
import { ReimbursableExpenseInvoicing } from './ReimbursableExpenseInvoicing.service';

@Injectable()
export class ReimbursableExpensesSubscriber {
  constructor(private readonly invoicing: ReimbursableExpenseInvoicing) {}

  /**
   * Validates the reimbursement customer and invoice before the expense is
   * stored.
   * @param {IExpenseCreatingPayload}
   */
  @OnEvent(events.expenses.onCreating, { suppressErrors: false })
  async validateReimbursementOnCreating({
    expenseDTO,
    trx,
  }: IExpenseCreatingPayload) {
    await this.invoicing.validateReimbursement(expenseDTO, trx);
  }

  /**
   * Adds the created expense to the picked invoice as a line item.
   * @param {IExpenseCreatedPayload}
   */
  @OnEvent(events.expenses.onCreated, { suppressErrors: false })
  async addExpenseToInvoiceOnCreated({
    expense,
    expenseDTO,
    trx,
  }: IExpenseCreatedPayload) {
    if (!expenseDTO.reimbursable || !expenseDTO.reimburseInvoiceId) return;

    await this.invoicing.addExpenseToInvoice(
      expense.id,
      expenseDTO.reimburseInvoiceId,
      trx,
      // The expense attachments may not be linked yet by their own subscriber.
      (expenseDTO.attachments || []).map((attachment) => attachment.key),
    );
  }
}
