import { Inject, Injectable } from '@nestjs/common';
import { groupBy, sumBy } from 'lodash';
import * as moment from 'moment';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import { ServiceError } from '@/modules/Items/ServiceError';
import { Customer } from '@/modules/Customers/models/Customer';
import { Expense } from '@/modules/Expenses/models/Expense.model';
import { Job } from './models/Job.model';
import { JobLaborEntry } from './models/JobLaborEntry.model';
import {
  CreateJobDto,
  CreateLaborEntryDto,
  EditJobDto,
  EditLaborEntryDto,
  GetJobsQueryDto,
} from './dtos/Job.dto';
import { ERRORS, JobStatus, LaborEntryType } from './constants';
import {
  getJobEntryRate,
  getJobOvertimeRate,
  roundMoney,
  sumLaborAmount,
} from './utils';

export interface JobSummary {
  unbilledHours: number;
  unbilledOvertimeHours: number;
  unbilledDays: number;
  unbilledLaborAmount: number;
  unbilledExpensesAmount: number;
  unbilledAmount: number;
  billedAmount: number;
}

/**
 * Client jobs and the labor logged on them.
 */
@Injectable()
export class JobsService {
  constructor(
    @Inject(Job.name)
    private readonly jobModel: TenantModelProxy<typeof Job>,

    @Inject(JobLaborEntry.name)
    private readonly laborModel: TenantModelProxy<typeof JobLaborEntry>,

    @Inject(Customer.name)
    private readonly customerModel: TenantModelProxy<typeof Customer>,

    @Inject(Expense.name)
    private readonly expenseModel: TenantModelProxy<typeof Expense>,
  ) {}

  public async getJobs(query: GetJobsQueryDto = {}) {
    const jobs = await this.jobModel()
      .query()
      .withGraphFetched('client')
      .onBuild((builder) => {
        if (query.clientId) builder.where('contactId', query.clientId);
        if (query.status) builder.where('status', query.status);
      })
      .orderBy('createdAt', 'desc');

    const summaries = await this.getJobsSummaries(jobs.map((job) => job.id));
    return jobs.map((job) => this.transformJob(job, summaries[job.id]));
  }

  public async getJob(jobId: number) {
    const job = await this.getJobOrThrow(jobId, true);
    const summaries = await this.getJobsSummaries([job.id]);
    return this.transformJob(job, summaries[job.id]);
  }

  public async createJob(dto: CreateJobDto) {
    await this.validateClient(dto.clientId);
    const job = await this.jobModel()
      .query()
      .insertAndFetch(this.transformJobDto(dto));
    return this.getJob(job.id);
  }

  public async editJob(jobId: number, dto: EditJobDto) {
    await this.getJobOrThrow(jobId);
    await this.validateClient(dto.clientId);
    await this.jobModel()
      .query()
      .findById(jobId)
      .patch(this.transformJobDto(dto));
    return this.getJob(jobId);
  }

  public async deleteJob(jobId: number) {
    await this.getJobOrThrow(jobId);
    const [labor, expenses] = await Promise.all([
      this.laborModel().query().where('projectId', jobId).resultSize(),
      this.expenseModel().query().where('projectId', jobId).resultSize(),
    ]);
    if (labor > 0 || expenses > 0) {
      throw new ServiceError(
        ERRORS.JOB_HAS_TRANSACTIONS,
        'This job has labor or expenses. Mark it completed instead.',
      );
    }
    await this.jobModel().query().deleteById(jobId);
  }

  public async getLaborEntries(jobId: number) {
    await this.getJobOrThrow(jobId);
    return this.laborModel()
      .query()
      .where('projectId', jobId)
      .orderBy([
        { column: 'date', order: 'desc' },
        { column: 'id', order: 'desc' },
      ]);
  }

  public async createLaborEntry(jobId: number, dto: CreateLaborEntryDto) {
    const job = await this.getJobOrThrow(jobId);
    return this.laborModel()
      .query()
      .insertAndFetch({
        projectId: jobId,
        ...this.transformLaborDto(job, dto),
      });
  }

  public async editLaborEntry(entryId: number, dto: EditLaborEntryDto) {
    const entry = await this.getUnbilledLaborEntry(entryId);
    const job = await this.getJobOrThrow(entry.projectId);
    await this.laborModel()
      .query()
      .findById(entryId)
      .patch(this.transformLaborDto(job, dto));
    return this.laborModel().query().findById(entryId);
  }

  public async deleteLaborEntry(entryId: number) {
    await this.getUnbilledLaborEntry(entryId);
    await this.laborModel().query().deleteById(entryId);
  }

  public async getJobExpenses(jobId: number) {
    await this.getJobOrThrow(jobId);
    const expenses = await this.expenseModel()
      .query()
      .where('projectId', jobId)
      .withGraphFetched('attachments')
      .orderBy('paymentDate', 'desc');

    return expenses.map((expense) => ({
      id: expense.id,
      paymentDate: expense.paymentDate,
      description: expense.description,
      totalAmount: expense.totalAmount,
      receiptTag: expense.receiptTag,
      reimbursable: expense.reimbursable,
      reimburseInvoiceId: expense.reimburseInvoiceId,
      isPublished: !!expense.publishedAt,
      attachmentsCount: (expense.attachments || []).length,
    }));
  }

  public async getJobOrThrow(jobId: number, withClient = false) {
    const query = this.jobModel().query().findById(jobId);
    if (withClient) query.withGraphFetched('client');
    const job = await query;

    if (!job) {
      throw new ServiceError(ERRORS.JOB_NOT_FOUND, 'The job was not found.');
    }
    return job;
  }

  /**
   * Retrieves the unbilled labor and expense totals of the given jobs.
   */
  private async getJobsSummaries(
    jobsIds: number[],
  ): Promise<Record<number, JobSummary>> {
    if (jobsIds.length === 0) return {};

    const [labor, expenses] = await Promise.all([
      this.laborModel().query().whereIn('projectId', jobsIds),
      this.expenseModel()
        .query()
        .whereIn('projectId', jobsIds)
        .where('reimbursable', true)
        .whereNotNull('publishedAt'),
    ]);
    const laborByJob = groupBy(labor, 'projectId');
    const expensesByJob = groupBy(expenses, 'projectId');

    return Object.fromEntries(
      jobsIds.map((jobId) => {
        const jobLabor = laborByJob[jobId] || [];
        const jobExpenses = expensesByJob[jobId] || [];
        const unbilledLabor = jobLabor.filter((e) => !e.invoiceId);
        const billedLabor = jobLabor.filter((e) => e.invoiceId);
        const unbilledExpenses = jobExpenses.filter(
          (e) => !e.reimburseInvoiceId,
        );
        const billedExpenses = jobExpenses.filter((e) => e.reimburseInvoiceId);

        const unbilledLaborAmount = sumLaborAmount(unbilledLabor);
        const unbilledExpensesAmount = roundMoney(
          sumBy(unbilledExpenses, (e) => Number(e.totalAmount)),
        );
        const hoursOf = (type: LaborEntryType) =>
          sumBy(
            unbilledLabor.filter((e) => e.entryType === type),
            (e) => Number(e.quantity),
          );
        return [
          jobId,
          {
            unbilledHours: hoursOf(LaborEntryType.Hours),
            unbilledOvertimeHours: sumBy(unbilledLabor, (e) =>
              Number(e.overtimeHours),
            ),
            unbilledDays: hoursOf(LaborEntryType.Days),
            unbilledLaborAmount,
            unbilledExpensesAmount,
            unbilledAmount: roundMoney(
              unbilledLaborAmount + unbilledExpensesAmount,
            ),
            billedAmount: roundMoney(
              sumLaborAmount(billedLabor) +
                sumBy(billedExpenses, (e) => Number(e.totalAmount)),
            ),
          },
        ];
      }),
    );
  }

  private transformJob(job: Job, summary?: JobSummary) {
    return {
      id: job.id,
      name: job.name,
      clientId: job.contactId,
      clientName: job.client?.displayName,
      status: job.status || JobStatus.Active,
      hourlyRate: job.hourlyRate === null ? null : Number(job.hourlyRate),
      dayRate: job.dayRate === null ? null : Number(job.dayRate),
      overtimeBillable: !!job.overtimeBillable,
      overtimeRate:
        job.overtimeRate === null || job.overtimeRate === undefined
          ? null
          : Number(job.overtimeRate),
      effectiveOvertimeRate: getJobOvertimeRate(job),
      deadline: job.deadline,
      notes: job.notes,
      createdAt: job.createdAt,
      ...(summary || {}),
    };
  }

  private transformJobDto(dto: CreateJobDto | EditJobDto) {
    return {
      name: dto.name.trim(),
      contactId: dto.clientId,
      status: dto.status || JobStatus.Active,
      hourlyRate: dto.hourlyRate ?? null,
      dayRate: dto.dayRate ?? null,
      overtimeBillable: !!dto.overtimeBillable,
      overtimeRate: dto.overtimeBillable ? (dto.overtimeRate ?? null) : null,
      deadline: dto.deadline ? moment(dto.deadline).format('YYYY-MM-DD') : null,
      notes: dto.notes ?? null,
    };
  }

  private transformLaborDto(
    job: Job,
    dto: CreateLaborEntryDto | EditLaborEntryDto,
  ) {
    const rate = dto.rate ?? getJobEntryRate(job, dto.entryType);
    const overtimeHours =
      dto.entryType === LaborEntryType.Hours ? dto.overtimeHours || 0 : 0;
    const overtimeRate =
      overtimeHours > 0 ? (dto.overtimeRate ?? getJobOvertimeRate(job)) : 0;

    if (!(rate > 0) && dto.quantity > 0) {
      throw new ServiceError(
        ERRORS.LABOR_RATE_MISSING,
        dto.entryType === LaborEntryType.Days
          ? 'Set a day rate on the job or enter a rate.'
          : 'Set an hourly rate on the job or enter a rate.',
      );
    }
    return {
      date: moment(dto.date).format('YYYY-MM-DD'),
      entryType: dto.entryType,
      quantity: dto.quantity,
      overtimeHours,
      rate,
      overtimeRate,
      description: dto.description ?? null,
    };
  }

  private async getUnbilledLaborEntry(entryId: number) {
    const entry = await this.laborModel().query().findById(entryId);

    if (!entry) {
      throw new ServiceError(
        ERRORS.LABOR_ENTRY_NOT_FOUND,
        'The labor entry was not found.',
      );
    }
    if (entry.invoiceId) {
      throw new ServiceError(
        ERRORS.LABOR_ENTRY_INVOICED,
        'This labor is already on an invoice. Delete the invoice to change it.',
      );
    }
    return entry;
  }

  private async validateClient(clientId: number) {
    const client = await this.customerModel().query().findById(clientId);
    if (!client) {
      throw new ServiceError(
        ERRORS.JOB_CLIENT_NOT_FOUND,
        'The client was not found.',
      );
    }
  }
}
