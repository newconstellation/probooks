import { LaborEntryType } from './constants';
import {
  buildLaborInvoiceLines,
  formatDateSpan,
  getJobOvertimeRate,
  sumLaborAmount,
} from './utils';

describe('getJobOvertimeRate', () => {
  it('is zero when overtime is not billed', () => {
    expect(
      getJobOvertimeRate({ hourlyRate: 80, overtimeBillable: false }),
    ).toBe(0);
  });

  it('defaults to 1.5x the hourly rate', () => {
    expect(getJobOvertimeRate({ hourlyRate: 85, overtimeBillable: true })).toBe(
      127.5,
    );
  });

  it("uses the job's own overtime rate", () => {
    expect(
      getJobOvertimeRate({
        hourlyRate: 85,
        overtimeBillable: true,
        overtimeRate: 150,
      }),
    ).toBe(150);
  });
});

describe('buildLaborInvoiceLines', () => {
  const entries = [
    {
      date: '2026-11-03',
      entryType: LaborEntryType.Hours,
      quantity: 8,
      overtimeHours: 2,
      rate: 85,
      overtimeRate: 127.5,
    },
    {
      date: '2026-11-04',
      entryType: LaborEntryType.Hours,
      quantity: 7.5,
      overtimeHours: 0,
      rate: 85,
      overtimeRate: 127.5,
    },
    {
      date: '2026-11-10',
      entryType: LaborEntryType.Days,
      quantity: 2,
      overtimeHours: 0,
      rate: 600,
      overtimeRate: 0,
    },
  ];

  it('groups hours, overtime and days into one line each', () => {
    expect(buildLaborInvoiceLines(entries)).toEqual([
      {
        kind: 'hours',
        quantity: 15.5,
        rate: 85,
        description: 'Labor, 15.5 hours (Nov 3 – Nov 4, 2026)',
      },
      {
        kind: 'overtime',
        quantity: 2,
        rate: 127.5,
        description: 'Overtime, 2 hours (Nov 3, 2026)',
      },
      {
        kind: 'days',
        quantity: 2,
        rate: 600,
        description: 'Labor, 2 days (Nov 10, 2026)',
      },
    ]);
  });

  it('keeps a separate line per rate', () => {
    const lines = buildLaborInvoiceLines([
      ...entries,
      {
        date: '2026-11-05',
        entryType: LaborEntryType.Hours,
        quantity: 1,
        rate: 95,
      },
    ]);
    expect(lines.filter((l) => l.kind === 'hours').map((l) => l.rate)).toEqual([
      85, 95,
    ]);
  });

  it('sums the labor amount', () => {
    expect(sumLaborAmount(entries)).toBe(15.5 * 85 + 2 * 127.5 + 1200);
  });
});

describe('formatDateSpan', () => {
  it('spans years', () => {
    expect(formatDateSpan(['2026-12-30', '2027-01-02'])).toBe(
      'Dec 30, 2026 – Jan 2, 2027',
    );
  });
});
