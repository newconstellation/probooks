import { TenantBaseModel } from '@/modules/System/models/TenantBaseModel';
import { LaborEntryType } from '../constants';

/**
 * Labor logged on a job: hours (with optional overtime hours) or days.
 */
export class JobLaborEntry extends TenantBaseModel {
  public id!: number;
  public projectId!: number;
  public date!: Date | string;
  public entryType!: LaborEntryType;
  public quantity!: number;
  public overtimeHours!: number;
  public rate!: number;
  public overtimeRate!: number;
  public description?: string | null;
  public invoiceId?: number | null;

  public createdAt?: Date;
  public updatedAt?: Date;

  static get tableName() {
    return 'job_labor_entries';
  }

  get timestamps() {
    return ['createdAt', 'updatedAt'];
  }

  /**
   * The billable amount of the entry.
   */
  get amount(): number {
    return (
      Number(this.quantity) * Number(this.rate) +
      Number(this.overtimeHours) * Number(this.overtimeRate)
    );
  }

  static get virtualAttributes() {
    return ['amount'];
  }
}
