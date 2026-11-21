import { Model } from 'objection';
import { TenantBaseModel } from '@/modules/System/models/TenantBaseModel';
import { Customer } from '@/modules/Customers/models/Customer';
import { JobStatus } from '../constants';

/**
 * A client job (or project) that labor and expenses are billed to. Stored in
 * the `projects` table.
 */
export class Job extends TenantBaseModel {
  public id!: number;
  public name!: string;
  public contactId!: number;
  public status!: JobStatus;
  public deadline?: Date | string | null;
  public costEstimate?: number | null;
  public hourlyRate?: number | null;
  public dayRate?: number | null;
  public overtimeBillable!: boolean;
  public overtimeRate?: number | null;
  public notes?: string | null;

  public createdAt?: Date;
  public updatedAt?: Date;

  public client?: Customer;

  static get tableName() {
    return 'projects';
  }

  get timestamps() {
    return ['createdAt', 'updatedAt'];
  }

  static get relationMappings() {
    return {
      client: {
        relation: Model.BelongsToOneRelation,
        modelClass: Customer,
        join: {
          from: 'projects.contactId',
          to: 'contacts.id',
        },
      },
    };
  }
}
