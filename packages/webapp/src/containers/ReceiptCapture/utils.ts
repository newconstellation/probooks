import moment from 'moment';
import { ACCOUNT_TYPE } from '@/constants/accountTypes';

export type TaxTreatment = 'deductible' | 'meals_50' | 'personal';

const TAX_TREATMENT_LABELS: Record<TaxTreatment, string> = {
  deductible: 'Deductible',
  meals_50: '50% meal',
  personal: 'Personal',
};

/**
 * Label for an expense's tax tag, or a dash when it has none.
 */
export function getTaxTreatmentLabel(value?: string | null): string {
  return TAX_TREATMENT_LABELS[value as TaxTreatment] || '-';
}

export type ReceiptTag =
  | 'meals'
  | 'baggage'
  | 'airfare'
  | 'lodging'
  | 'parking'
  | 'rideshare'
  | 'fuel'
  | 'office_supplies'
  | 'phone_internet'
  | 'shipping'
  | 'personal'
  | 'other';

export interface ReceiptTagOption {
  value: ReceiptTag;
  label: string;
  icon: string;
  taxTreatment: TaxTreatment;
  /** Expense account the tag files into; created the first time if missing. */
  accountName?: string;
  /** Matches an existing expense account to use instead of creating one. */
  accountMatch?: RegExp;
}

/**
 * Quick answers for "what was this receipt for?". "Other deductible" is the
 * catch-all and keeps whatever category is picked.
 */
export const RECEIPT_TAG_OPTIONS: ReceiptTagOption[] = [
  {
    value: 'meals',
    label: 'Meal (50%)',
    icon: 'glass',
    taxTreatment: 'meals_50',
    accountName: 'Meals',
    accountMatch: /meal|dining|entertainment/i,
  },
  {
    value: 'rideshare',
    label: 'Uber / Lyft / Taxi',
    icon: 'taxi',
    taxTreatment: 'deductible',
    accountName: 'Travel',
    accountMatch: /travel/i,
  },
  {
    value: 'parking',
    label: 'Parking & tolls',
    icon: 'drive-time',
    taxTreatment: 'deductible',
    accountName: 'Parking & Tolls',
    accountMatch: /parking|toll/i,
  },
  {
    value: 'baggage',
    label: 'Baggage fee',
    icon: 'briefcase',
    taxTreatment: 'deductible',
    accountName: 'Travel',
    accountMatch: /travel/i,
  },
  {
    value: 'airfare',
    label: 'Airfare',
    icon: 'airplane',
    taxTreatment: 'deductible',
    accountName: 'Travel',
    accountMatch: /travel/i,
  },
  {
    value: 'lodging',
    label: 'Hotel',
    icon: 'office',
    taxTreatment: 'deductible',
    accountName: 'Travel',
    accountMatch: /travel|lodging|hotel/i,
  },
  {
    value: 'fuel',
    label: 'Gas / fuel',
    icon: 'oil-field',
    taxTreatment: 'deductible',
    accountName: 'Car & Truck',
    accountMatch: /car|truck|vehicle|auto|fuel|gas/i,
  },
  {
    value: 'office_supplies',
    label: 'Office supplies',
    icon: 'paperclip',
    taxTreatment: 'deductible',
    accountName: 'Office Supplies',
    accountMatch: /office/i,
  },
  {
    value: 'phone_internet',
    label: 'Phone & internet',
    icon: 'mobile-phone',
    taxTreatment: 'deductible',
    accountName: 'Phone & Internet',
    accountMatch: /phone|internet|telephone|utilit/i,
  },
  {
    value: 'shipping',
    label: 'Shipping & postage',
    icon: 'box',
    taxTreatment: 'deductible',
    accountName: 'Shipping & Postage',
    accountMatch: /shipping|postage|freight/i,
  },
  {
    value: 'personal',
    label: 'Personal',
    icon: 'person',
    taxTreatment: 'personal',
  },
  {
    value: 'other',
    label: 'Other deductible',
    icon: 'tick',
    taxTreatment: 'deductible',
  },
];

export function getReceiptTagOption(value?: string | null) {
  return RECEIPT_TAG_OPTIONS.find((o) => o.value === value);
}

/**
 * Label for an expense's quick tag, or a dash when it has none.
 */
export function getReceiptTagLabel(value?: string | null): string {
  return getReceiptTagOption(value)?.label || '-';
}

export const TAX_TREATMENT_HINTS: Record<TaxTreatment, string> = {
  deductible: 'Counts as a normal business expense.',
  meals_50: 'Business meals usually count at 50% for taxes.',
  personal: 'Not deductible. Paid with business money for something personal.',
};

/** Category value for an account that will be created when the receipt is saved. */
export const NEW_CATEGORY_PREFIX = 'new:';

export function isNewCategory(value: string) {
  return value.startsWith(NEW_CATEGORY_PREFIX);
}

/**
 * Picks the category for a quick tag: an existing account that matches, the
 * name of one to create, or the current pick for tags without a category.
 */
export function getTagCategory(
  tag: ReceiptTagOption,
  categories: CaptureAccount[],
  currentCategory: string,
): string {
  if (!tag.accountName) {
    return isNewCategory(currentCategory) ? '' : currentCategory;
  }
  const exact = categories.find(
    (a) => a.name.toLowerCase() === tag.accountName!.toLowerCase(),
  );
  const match = exact || categories.find((a) => tag.accountMatch?.test(a.name));
  return match ? String(match.id) : `${NEW_CATEGORY_PREFIX}${tag.accountName}`;
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
  receiptTag: ReceiptTag;
  reimbursable: boolean;
  reimburseCustomerId: string;
  reimburseInvoiceId: string;
  projectId: string;
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
  if (values.reimbursable && !values.reimburseCustomerId)
    return 'Pick the client who will pay you back.';
  return null;
}

/**
 * Builds the create-expense request for a captured receipt.
 */
export function buildExpenseRequest(
  values: ReceiptCaptureValues,
  attachmentKey: string,
  categoryAccountId: number = Number(values.categoryAccountId),
) {
  const amount = parseAmount(values.amount) as number;
  const description = values.description.trim() || 'Receipt';

  return {
    paymentDate: values.date,
    paymentAccountId: Number(values.paidFromAccountId),
    description,
    referenceNo: '',
    publish: true,
    receiptTag: values.receiptTag,
    taxTreatment:
      getReceiptTagOption(values.receiptTag)?.taxTreatment || 'deductible',
    reimbursable: values.reimbursable,
    ...(values.reimbursable
      ? {
          reimburseCustomerId: Number(values.reimburseCustomerId),
          ...(values.projectId ? { projectId: Number(values.projectId) } : {}),
          ...(values.reimburseInvoiceId
            ? { reimburseInvoiceId: Number(values.reimburseInvoiceId) }
            : {}),
        }
      : {}),
    categories: [
      {
        index: 1,
        expenseAccountId: categoryAccountId,
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

export interface ReimburseInvoice {
  id: number;
  invoiceNo?: string;
  customerId: number;
  invoiceDate?: string;
  dueAmount?: number;
  totalFormatted?: string;
  isDelivered?: boolean;
  isFullyPaid?: boolean;
  isWrittenoff?: boolean;
}

/**
 * Invoices a reimbursable receipt can be added to: the customer's invoices
 * that are not paid in full or written off, newest first.
 */
export function getOpenInvoicesForCustomer(
  invoices: ReimburseInvoice[] = [],
  customerId: string,
): ReimburseInvoice[] {
  if (!customerId) return [];
  return invoices
    .filter(
      (inv) =>
        String(inv.customerId) === customerId &&
        !inv.isFullyPaid &&
        !inv.isWrittenoff,
    )
    .sort((a, b) =>
      String(b.invoiceDate || '').localeCompare(String(a.invoiceDate || '')),
    );
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
