import { defaultTo } from 'lodash';
import React from 'react';
import intl from 'react-intl-universal';
import styled from 'styled-components';
import { ExpenseDetailsStatus } from './components';
import { useExpenseDrawerContext } from './ExpenseDrawerProvider';
import {
  CommercialDocHeader,
  CommercialDocTopHeader,
  Row,
  Col,
  DetailItem,
  DetailsMenu,
  ExchangeRateDetailItem,
} from '@/components';
import {
  getReceiptTagLabel,
  getTaxTreatmentLabel,
} from '@/containers/ReceiptCapture/utils';
import { useCustomer } from '@/hooks/query/customers';
import { useInvoice } from '@/hooks/query/invoices';

interface ExpenseReceiptFields {
  taxTreatment?: string | null;
  receiptTag?: string | null;
  reimbursable?: boolean;
  reimburseCustomerId?: number | null;
  reimburseInvoiceId?: number | null;
}

/**
 * Who pays the expense back, and the invoice it was billed on.
 */
function ReimbursementDetail({ expense }: { expense: ExpenseReceiptFields }) {
  const { data: customer } = useCustomer(expense.reimburseCustomerId, {
    enabled: !!expense.reimburseCustomerId,
  });
  const { data: invoice } = useInvoice(expense.reimburseInvoiceId, {
    enabled: !!expense.reimburseInvoiceId,
  });
  const customerName = (customer as { displayName?: string })?.displayName;
  const invoiceNo = (invoice as { invoiceNo?: string })?.invoiceNo;

  if (!expense.reimbursable) return <>No</>;
  if (expense.reimburseInvoiceId) {
    return (
      <>
        {customerName ? `${customerName}, ` : ''}on invoice{' '}
        {invoiceNo || expense.reimburseInvoiceId}
      </>
    );
  }
  return <>{customerName ? `${customerName}, ` : ''}not invoiced yet</>;
}

/**
 * Expense drawer content.
 */
export function ExpenseDrawerHeader() {
  const { expense } = useExpenseDrawerContext();
  const receiptFields = (expense || {}) as ExpenseReceiptFields;

  return (
    <CommercialDocHeader>
      <CommercialDocTopHeader>
        <DetailsMenu>
          <DetailItem name={'amount'} label={intl.get('full_amount')}>
            <h3 className="big-number">{expense?.formattedAmount}</h3>
          </DetailItem>

          <StatusDetailItem>
            <ExpenseDetailsStatus expense={expense} />
          </StatusDetailItem>
        </DetailsMenu>
      </CommercialDocTopHeader>

      <Row>
        <Col xs={6}>
          <DetailsMenu direction={'horizantal'} minLabelSize={'180px'}>
            <DetailItem name={'date'} label={intl.get('date')}>
              {expense?.formattedDate}
            </DetailItem>

            <DetailItem name={'reference'} label={intl.get('reference_no')}>
              {defaultTo(expense?.referenceNo, '-')}
            </DetailItem>

            <DetailItem name={'receipt-tag'} label={'What it was for'}>
              {getReceiptTagLabel(receiptFields.receiptTag)}
            </DetailItem>

            <DetailItem name={'tax-treatment'} label={'For taxes'}>
              {getTaxTreatmentLabel(receiptFields.taxTreatment)}
            </DetailItem>

            <DetailItem name={'reimbursable'} label={'Bill back'}>
              <ReimbursementDetail expense={receiptFields} />
            </DetailItem>

            <ExchangeRateDetailItem
              exchangeRate={expense?.exchangeRate}
              toCurrency={expense?.currencyCode}
            />
          </DetailsMenu>
        </Col>

        <Col xs={6}>
          <DetailsMenu
            textAlign={'right'}
            direction={'horizantal'}
            minLabelSize={'180px'}
          >
            <DetailItem label={intl.get('published_at')}>
              {expense?.formattedPublishedAt || '—'}
            </DetailItem>

            <DetailItem label={intl.get('created_at')}>
              {expense?.formattedCreatedAt}
            </DetailItem>
          </DetailsMenu>
        </Col>
      </Row>
    </CommercialDocHeader>
  );
}

const StatusDetailItem = styled(DetailItem)`
  width: 50%;
  text-align: right;
  position: relative;
  top: -5px;
`;
