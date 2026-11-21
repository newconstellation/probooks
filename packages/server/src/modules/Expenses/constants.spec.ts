import {
  EXPENSE_RECEIPT_TAGS,
  ExpenseReceiptTag,
  ExpenseTaxTreatment,
  getReceiptTagTaxTreatment,
} from './constants';

describe('getReceiptTagTaxTreatment', () => {
  it('counts meals at 50%', () => {
    expect(getReceiptTagTaxTreatment(ExpenseReceiptTag.Meals)).toBe(
      ExpenseTaxTreatment.Meals50,
    );
  });

  it('marks personal receipts as personal', () => {
    expect(getReceiptTagTaxTreatment(ExpenseReceiptTag.Personal)).toBe(
      ExpenseTaxTreatment.Personal,
    );
  });

  it('treats every other tag as deductible', () => {
    EXPENSE_RECEIPT_TAGS.filter(
      (tag) =>
        tag !== ExpenseReceiptTag.Meals && tag !== ExpenseReceiptTag.Personal,
    ).forEach((tag) => {
      expect(getReceiptTagTaxTreatment(tag)).toBe(
        ExpenseTaxTreatment.Deductible,
      );
    });
  });
});
