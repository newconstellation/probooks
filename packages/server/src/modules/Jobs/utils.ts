import * as moment from 'moment';
import { DEFAULT_OVERTIME_MULTIPLIER, LaborEntryType } from './constants';

export interface JobRates {
  hourlyRate?: number | null;
  dayRate?: number | null;
  overtimeBillable?: boolean;
  overtimeRate?: number | null;
}

/**
 * The overtime rate of a job: its own, or 1.5x the hourly rate. Zero when
 * overtime is not billed on the job.
 */
export function getJobOvertimeRate(job: JobRates): number {
  if (!job.overtimeBillable) return 0;
  if (job.overtimeRate !== null && job.overtimeRate !== undefined) {
    return Number(job.overtimeRate);
  }
  return roundMoney(Number(job.hourlyRate || 0) * DEFAULT_OVERTIME_MULTIPLIER);
}

/**
 * The default rate of a labor entry on the given job.
 */
export function getJobEntryRate(job: JobRates, type: LaborEntryType): number {
  return Number(
    (type === LaborEntryType.Days ? job.dayRate : job.hourlyRate) || 0,
  );
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface LaborEntryLike {
  date: Date | string;
  entryType: LaborEntryType | string;
  quantity: number | string;
  overtimeHours?: number | string | null;
  rate: number | string;
  overtimeRate?: number | string | null;
}

export interface InvoiceLaborLine {
  kind: 'hours' | 'overtime' | 'days';
  quantity: number;
  rate: number;
  description: string;
}

const formatQuantity = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, '');

/**
 * Formats the dates the entries span, like "Nov 3 – Nov 14, 2026".
 */
export function formatDateSpan(dates: Array<Date | string>): string {
  const sorted = dates.map((d) => moment(d)).sort((a, b) => a.diff(b));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first) return '';
  if (first.isSame(last, 'day')) return first.format('MMM D, YYYY');
  if (first.isSame(last, 'year')) {
    return `${first.format('MMM D')} – ${last.format('MMM D, YYYY')}`;
  }
  return `${first.format('MMM D, YYYY')} – ${last.format('MMM D, YYYY')}`;
}

/**
 * Groups labor entries into invoice lines: regular hours, overtime hours and
 * days, one line per rate.
 */
export function buildLaborInvoiceLines(
  entries: LaborEntryLike[],
): InvoiceLaborLine[] {
  const groups = new Map<
    string,
    {
      kind: InvoiceLaborLine['kind'];
      rate: number;
      quantity: number;
      dates: Array<Date | string>;
    }
  >();
  const add = (
    kind: InvoiceLaborLine['kind'],
    rate: number,
    quantity: number,
    date: Date | string,
  ) => {
    if (!(quantity > 0)) return;
    const key = `${kind}:${rate}`;
    const group = groups.get(key) || { kind, rate, quantity: 0, dates: [] };
    group.quantity += quantity;
    group.dates.push(date);
    groups.set(key, group);
  };
  entries.forEach((entry) => {
    const kind = entry.entryType === LaborEntryType.Days ? 'days' : 'hours';
    add(kind, Number(entry.rate), Number(entry.quantity), entry.date);
    add(
      'overtime',
      Number(entry.overtimeRate || 0),
      Number(entry.overtimeHours || 0),
      entry.date,
    );
  });
  const order = { hours: 0, overtime: 1, days: 2 };
  const labels = {
    hours: (q: number) =>
      `Labor, ${formatQuantity(q)} ${q === 1 ? 'hour' : 'hours'}`,
    overtime: (q: number) =>
      `Overtime, ${formatQuantity(q)} ${q === 1 ? 'hour' : 'hours'}`,
    days: (q: number) =>
      `Labor, ${formatQuantity(q)} ${q === 1 ? 'day' : 'days'}`,
  };
  return [...groups.values()]
    .sort((a, b) => order[a.kind] - order[b.kind] || a.rate - b.rate)
    .map((group) => {
      const quantity = Math.round(group.quantity * 1000) / 1000;
      return {
        kind: group.kind,
        quantity,
        rate: group.rate,
        description: `${labels[group.kind](quantity)} (${formatDateSpan(group.dates)})`,
      };
    });
}

/**
 * Sums the billable amount of labor entries.
 */
export function sumLaborAmount(entries: LaborEntryLike[]): number {
  return roundMoney(
    entries.reduce(
      (sum, e) =>
        sum +
        Number(e.quantity) * Number(e.rate) +
        Number(e.overtimeHours || 0) * Number(e.overtimeRate || 0),
      0,
    ),
  );
}
