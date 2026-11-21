import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { events } from '@/common/events/events';
import { ServiceError } from '@/modules/Items/ServiceError';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import { IExpenseCreatingPayload } from '@/modules/Expenses/interfaces/Expenses.interface';
import { ISaleInvoiceDeletingPayload } from '@/modules/SaleInvoices/SaleInvoice.types';
import { Job } from './models/Job.model';
import { JobInvoicing } from './JobInvoicing.service';
import { ERRORS } from './constants';

@Injectable()
export class JobsSubscriber {
  constructor(
    private readonly jobInvoicing: JobInvoicing,

    @Inject(Job.name)
    private readonly jobModel: TenantModelProxy<typeof Job>,
  ) {}

  /**
   * Validates the job a new expense is billed to belongs to its client.
   */
  @OnEvent(events.expenses.onCreating, { suppressErrors: false })
  async validateExpenseJob({ expenseDTO, trx }: IExpenseCreatingPayload) {
    if (!expenseDTO.projectId) return;

    const job = await this.jobModel().query(trx).findById(expenseDTO.projectId);

    if (!job) {
      throw new ServiceError(ERRORS.JOB_NOT_FOUND, 'The job was not found.');
    }
    if (
      expenseDTO.reimburseCustomerId &&
      expenseDTO.reimburseCustomerId !== job.contactId
    ) {
      throw new ServiceError(
        ERRORS.JOB_CLIENT_MISMATCH,
        'The job belongs to another client.',
      );
    }
  }

  /**
   * Lets the labor and expenses of a deleted invoice be billed again.
   */
  @OnEvent(events.saleInvoice.onDeleting, { suppressErrors: false })
  async releaseOnInvoiceDeleting({
    oldSaleInvoice,
    trx,
  }: ISaleInvoiceDeletingPayload) {
    await this.jobInvoicing.releaseInvoice(oldSaleInvoice.id, trx);
  }
}
