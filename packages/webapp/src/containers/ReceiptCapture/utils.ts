import moment from 'moment';
import { ACCOUNT_TYPE } from '@/constants/accountTypes';

export type TaxTreatment = 'deductible' | 'meals_50' | 'personal';

export const TAX_TREATMENT_OPTIONS: Array<{
  value: TaxTreatment;
  label: string;
  hint: string;
}> = [
  {
    value: 'deductible',
    label: 'Deductible',
    hint: 'A normal business expense.',
  },
  {
    value: 'meals_50',
    label: '50% meal',
    hint: 'Business meals usually count at 50%.',
  },
  {
    value: 'personal',
    label: 'Personal',
    hint: 'Paid with business money for something personal.',
  },
];

/**
 * Label for an expense's tax tag, or a dash when it has none.
 */
export function getTaxTreatmentLabel(value?: string | null): string {
  return TAX_TREATMENT_OPTIONS.find((o) => o.value === value)?.label || '-';
}

export interface CaptureAccount {
  id: number;
  name: string;
  accountType: string;
}

export const CATEGORY_ACCOUNT_TYPES: string[] = [
  ACCOUNT_TYPE.EXPENSE,
  ACCOUNT_TYPE.OTHER_EXPENSE,
  ACCOUNT_TYPE.COST_OF_GOODS_SOLD,
];

export const PAID_FROM_ACCOUNT_TYPES: string[] = [
  ACCOUNT_TYPE.BANK,
  ACCOUNT_TYPE.CREDIT_CARD,
  ACCOUNT_TYPE.CASH,
];

/**
 * Splits the chart of accounts into what a receipt can be categorized as and
 * what it can be paid from.
 */
export function groupCaptureAccounts(accounts: CaptureAccount[] = []) {
  const byName = (a: CaptureAccount, b: CaptureAccount) =>
    a.name.localeCompare(b.name);

  return {
    categories: accounts
      .filter((a) => CATEGORY_ACCOUNT_TYPES.includes(a.accountType))
      .sort(byName),
    paidFrom: accounts
      .filter((a) => PAID_FROM_ACCOUNT_TYPES.includes(a.accountType))
      .sort(byName),
  };
}

/**
 * Parses what the person typed as an amount ("$1,234.50", "12") into a
 * positive number, or null when it is not a usable amount.
 */
export function parseAmount(input: string): number | null {
  const cleaned = (input || '').replace(/[^0-9.]/g, '');
  if (!cleaned || cleaned.split('.').length > 2) return null;
  const value = Math.round(parseFloat(cleaned) * 100) / 100;
  return Number.isFinite(value) && value > 0 ? value : null;
}

export interface ReceiptCaptureValues {
  amount: string;
  date: string;
  description: string;
  categoryAccountId: string;
  paidFromAccountId: string;
  taxTreatment: TaxTreatment;
}

export function todayISO() {
  return moment().format('YYYY-MM-DD');
}

/**
 * Returns the first problem with the form, or null when it can be saved.
 */
export function validateReceipt(
  values: ReceiptCaptureValues,
  hasPhoto: boolean,
): string | null {
  if (!hasPhoto) return 'Take a photo of the receipt first.';
  if (parseAmount(values.amount) === null) return 'Enter the receipt total.';
  if (!values.date) return 'Pick the receipt date.';
  if (!values.categoryAccountId) return 'Pick a category.';
  if (!values.paidFromAccountId) return 'Pick what you paid with.';
  return null;
}

/**
 * Builds the create-expense request for a captured receipt.
 */
export function buildExpenseRequest(
  values: ReceiptCaptureValues,
  attachmentKey: string,
) {
  const amount = parseAmount(values.amount) as number;
  const description = values.description.trim() || 'Receipt';

  return {
    paymentDate: values.date,
    paymentAccountId: Number(values.paidFromAccountId),
    description,
    referenceNo: '',
    publish: true,
    taxTreatment: values.taxTreatment,
    categories: [
      {
        index: 1,
        expenseAccountId: Number(values.categoryAccountId),
        amount,
        description,
      },
    ],
    attachments: [{ key: attachmentKey }],
  };
}

const STORAGE_PREFIX = 'probooks.receiptCapture.lastUsed.';

/**
 * Remembers the last category and payment account per business, so the next
 * receipt starts with them filled in. Storage can be unavailable; that is fine.
 */
export function loadLastUsed(organizationId?: string | null) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + organizationId);
    return raw ? (JSON.parse(raw) as Partial<ReceiptCaptureValues>) : {};
  } catch {
    return {};
  }
}

export function saveLastUsed(
  organizationId: string | null | undefined,
  values: Pick<ReceiptCaptureValues, 'categoryAccountId' | 'paidFromAccountId'>,
) {
  try {
    localStorage.setItem(
      STORAGE_PREFIX + organizationId,
      JSON.stringify(values),
    );
  } catch {
    // Ignore: remembering choices is only a convenience.
  }
}
