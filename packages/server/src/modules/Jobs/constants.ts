export const LABOR_ITEM_NAME = 'Labor';
export const LABOR_INCOME_ACCOUNT_SLUG = 'sales-of-service-income';

/** Overtime is billed at this multiple of the hourly rate unless a job sets its own. */
export const DEFAULT_OVERTIME_MULTIPLIER = 1.5;

export enum JobStatus {
  Active = 'active',
  Completed = 'completed',
}
export const JOB_STATUSES = Object.values(JobStatus);

export enum LaborEntryType {
  Hours = 'hours',
  Days = 'days',
}
export const LABOR_ENTRY_TYPES = Object.values(LaborEntryType);

export const ERRORS = {
  JOB_NOT_FOUND: 'JOB_NOT_FOUND',
  JOB_CLIENT_NOT_FOUND: 'JOB_CLIENT_NOT_FOUND',
  JOB_HAS_TRANSACTIONS: 'JOB_HAS_TRANSACTIONS',
  JOB_NOTHING_TO_INVOICE: 'JOB_NOTHING_TO_INVOICE',
  LABOR_ENTRY_NOT_FOUND: 'LABOR_ENTRY_NOT_FOUND',
  LABOR_ENTRY_INVOICED: 'LABOR_ENTRY_INVOICED',
  LABOR_RATE_MISSING: 'LABOR_RATE_MISSING',
  JOB_CLIENT_MISMATCH: 'JOB_CLIENT_MISMATCH',
};
