import type {
  ClientJob as Job,
  ClientJobLaborEntry as JobLaborEntry,
} from '@bigcapital/sdk-ts';

export const OVERTIME_MULTIPLIER = 1.5;

export interface JobFormValues {
  name: string;
  clientId: string;
  hourlyRate: string;
  dayRate: string;
  overtimeBillable: boolean;
  overtimeRate: string;
  notes: string;
  status: 'active' | 'completed';
}

export const emptyJobForm = (clientId = ''): JobFormValues => ({
  name: '',
  clientId,
  hourlyRate: '',
  dayRate: '',
  overtimeBillable: false,
  overtimeRate: '',
  notes: '',
  status: 'active',
});

export function jobToForm(job: Job): JobFormValues {
  const str = (v: number | null | undefined) =>
    v === null || v === undefined ? '' : String(v);
  return {
    name: job.name,
    clientId: String(job.clientId),
    hourlyRate: str(job.hourlyRate),
    dayRate: str(job.dayRate),
    overtimeBillable: job.overtimeBillable,
    overtimeRate: str(job.overtimeRate),
    notes: job.notes || '',
    status: job.status,
  };
}

/**
 * Parses an amount the person typed ("$85", "1,200.50"); null when empty or
 * not a number.
 */
export function parseNumber(input: string): number | null {
  const cleaned = (input || '').replace(/[^0-9.]/g, '');
  if (!cleaned || cleaned.split('.').length > 2) return null;
  const value = parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function validateJobForm(values: JobFormValues): string | null {
  if (!values.name.trim()) return 'Give the job a name.';
  if (!values.clientId) return 'Pick the client.';
  if (
    parseNumber(values.hourlyRate) === null &&
    parseNumber(values.dayRate) === null
  )
    return 'Enter an hourly rate, a day rate, or both.';
  return null;
}

export function jobFormToRequest(values: JobFormValues) {
  return {
    name: values.name.trim(),
    clientId: Number(values.clientId),
    hourlyRate: parseNumber(values.hourlyRate),
    dayRate: parseNumber(values.dayRate),
    overtimeBillable: values.overtimeBillable,
    overtimeRate: values.overtimeBillable
      ? parseNumber(values.overtimeRate)
      : null,
    notes: values.notes.trim() || null,
    status: values.status,
  };
}

export interface LaborFormValues {
  date: string;
  entryType: 'hours' | 'days';
  quantity: string;
  overtimeHours: string;
  description: string;
}

export function validateLaborForm(values: LaborFormValues): string | null {
  const quantity = parseNumber(values.quantity) || 0;
  const overtime = parseNumber(values.overtimeHours) || 0;
  if (!values.date) return 'Pick the date.';
  if (quantity <= 0 && overtime <= 0)
    return values.entryType === 'days'
      ? 'Enter the number of days.'
      : 'Enter the hours worked.';
  if (values.entryType === 'hours' && quantity > 24)
    return 'That is more than 24 hours in a day.';
  return null;
}

export function laborFormToRequest(values: LaborFormValues) {
  return {
    date: values.date,
    entryType: values.entryType,
    quantity: parseNumber(values.quantity) || 0,
    overtimeHours:
      values.entryType === 'hours' ? parseNumber(values.overtimeHours) || 0 : 0,
    description: values.description.trim() || null,
  };
}

/**
 * Preview of what a labor entry will bill at the job's rates.
 */
export function previewLaborAmount(job: Job, values: LaborFormValues): number {
  const quantity = parseNumber(values.quantity) || 0;
  if (values.entryType === 'days') return quantity * Number(job.dayRate || 0);
  const overtime = job.overtimeBillable
    ? parseNumber(values.overtimeHours) || 0
    : 0;
  return (
    quantity * Number(job.hourlyRate || 0) +
    overtime * Number(job.effectiveOvertimeRate || 0)
  );
}

const plural = (n: number, one: string, many: string) =>
  `${Number.isInteger(n) ? n : Number(n.toFixed(2))} ${n === 1 ? one : many}`;

export function describeLabor(entry: JobLaborEntry): string {
  const quantity = Number(entry.quantity);
  const overtime = Number(entry.overtimeHours);
  if (entry.entryType === 'days') return plural(quantity, 'day', 'days');
  const base = quantity > 0 ? plural(quantity, 'hour', 'hours') : '';
  const ot =
    overtime > 0 ? `${plural(overtime, 'hour', 'hours')} overtime` : '';
  return [base, ot].filter(Boolean).join(' + ');
}

export function describeRates(
  job: Job,
  formatMoney: (n: number) => string,
): string {
  const parts: string[] = [];
  if (job.hourlyRate) parts.push(`${formatMoney(job.hourlyRate)}/hr`);
  if (job.dayRate) parts.push(`${formatMoney(job.dayRate)}/day`);
  parts.push(
    job.overtimeBillable
      ? `Overtime ${formatMoney(job.effectiveOvertimeRate)}/hr`
      : 'No overtime billing',
  );
  return parts.join(' · ');
}
