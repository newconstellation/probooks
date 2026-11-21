import { fetchAccounts } from '@bigcapital/sdk-ts';
import {
  Button,
  Callout,
  FormGroup,
  HTMLSelect,
  Icon,
  InputGroup,
  Intent,
  Spinner,
  Switch,
} from '@blueprintjs/core';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import styled, { createGlobalStyle } from 'styled-components';
import {
  buildExpenseRequest,
  CaptureAccount,
  getOpenInvoicesForCustomer,
  getReceiptTagOption,
  getTagCategory,
  groupCaptureAccounts,
  isNewCategory,
  loadLastUsed,
  NEW_CATEGORY_PREFIX,
  parseAmount,
  RECEIPT_TAG_OPTIONS,
  ReceiptCaptureValues,
  ReimburseInvoice,
  saveLastUsed,
  TAX_TREATMENT_HINTS,
  todayISO,
  validateReceipt,
} from './utils';
import { useWorkspaces } from '@/ee/workspaces/hooks/query';
import { useAccounts, useCreateAccount } from '@/hooks/query/accounts';
import { useUploadAttachments } from '@/hooks/query/attachments';
import { useClientJobs } from '@/hooks/query/client-jobs';
import { useCustomers } from '@/hooks/query/customers';
import { useCreateExpense } from '@/hooks/query/expenses';
import { useInvoices } from '@/hooks/query/invoices';
import { useCurrentOrganization } from '@/hooks/query/organization';
import { useAuthOrganizationId } from '@/hooks/state';
import { useApiFetcher } from '@/hooks/useRequest';
import { setCookie } from '@/utils';

interface SavedReceipt {
  amount: number;
  category: string;
  invoiceNo?: string;
  customerName?: string;
  jobName?: string;
}

/**
 * Phone-first screen to snap a receipt and save it as an expense with the
 * photo attached and a tax tag.
 */
export function ReceiptCapturePage() {
  const organizationId = useAuthOrganizationId();
  const { data: organization } = useCurrentOrganization();
  const { data: workspaces = [] } = useWorkspaces();
  const { data: accounts, isLoading: isAccountsLoading } = useAccounts({});
  const { mutateAsync: uploadAttachment } = useUploadAttachments();
  const { mutateAsync: createExpense } = useCreateExpense();
  const { mutateAsync: createAccount } = useCreateAccount();
  const fetcher = useApiFetcher({ enableCamelCaseTransform: true });

  const { categories, paidFrom } = useMemo(
    () => groupCaptureAccounts((accounts || []) as unknown as CaptureAccount[]),
    [accounts],
  );

  const emptyValues = (): ReceiptCaptureValues => {
    const lastUsed = loadLastUsed(organizationId);
    return {
      amount: '',
      date: todayISO(),
      description: '',
      categoryAccountId: lastUsed.categoryAccountId || '',
      paidFromAccountId: lastUsed.paidFromAccountId || '',
      receiptTag: 'other',
      reimbursable: false,
      reimburseCustomerId: '',
      reimburseInvoiceId: '',
      projectId: '',
    };
  };
  const [values, setValues] = useState<ReceiptCaptureValues>(emptyValues);

  const { data: customersData } = useCustomers(
    { page_size: 500 },
    { enabled: values.reimbursable },
  );
  const customers = (customersData?.data || []) as Array<{
    id: number;
    displayName: string;
  }>;
  const { data: clientJobs = [] } = useClientJobs(
    {
      client_id: Number(values.reimburseCustomerId) || undefined,
      status: 'active',
    },
    { enabled: !!values.reimburseCustomerId },
  );
  const { data: invoicesData, isFetching: isInvoicesFetching } = useInvoices(
    { page_size: 500 } as Parameters<typeof useInvoices>[0],
    { enabled: !!values.reimburseCustomerId } as Parameters<
      typeof useInvoices
    >[1],
  );
  const openInvoices = useMemo(
    () =>
      getOpenInvoicesForCustomer(
        (invoicesData?.data || []) as unknown as ReimburseInvoice[],
        values.reimburseCustomerId,
      ),
    [invoicesData, values.reimburseCustomerId],
  );
  const pendingCategoryName = isNewCategory(values.categoryAccountId)
    ? values.categoryAccountId.slice(NEW_CATEGORY_PREFIX.length)
    : null;
  const selectedTag = getReceiptTagOption(values.receiptTag);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState<SavedReceipt | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drop remembered accounts that no longer exist in this business.
  useEffect(() => {
    if (!accounts) return;
    setValues((v) => ({
      ...v,
      categoryAccountId:
        isNewCategory(v.categoryAccountId) ||
        categories.some((a) => String(a.id) === v.categoryAccountId)
          ? v.categoryAccountId
          : '',
      paidFromAccountId: paidFrom.some(
        (a) => String(a.id) === v.paidFromAccountId,
      )
        ? v.paidFromAccountId
        : '',
    }));
  }, [accounts, categories, paidFrom]);

  useEffect(() => {
    if (!photo) {
      setPhotoUrl(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const setField =
    (field: keyof ReceiptCaptureValues) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      setError(null);
      setValues((v) => ({ ...v, [field]: e.target.value }));
    };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setError(null);
      setPhoto(file);
    }
    // Let the same photo be picked again after a reset.
    e.target.value = '';
  };

  const handlePickTag = (tagValue: ReceiptCaptureValues['receiptTag']) => {
    const tag = getReceiptTagOption(tagValue);
    if (!tag) return;
    setError(null);
    setValues((v) => ({
      ...v,
      receiptTag: tag.value,
      categoryAccountId: getTagCategory(tag, categories, v.categoryAccountId),
    }));
  };

  /**
   * Returns the category account id, creating the tag's account the first
   * time it is used in this business.
   */
  const resolveCategoryAccountId = async (): Promise<number> => {
    if (!pendingCategoryName) return Number(values.categoryAccountId);

    await createAccount({
      name: pendingCategoryName,
      accountType: 'expense',
    } as Parameters<typeof createAccount>[0]);
    const refreshed = (await fetchAccounts(fetcher, {})) as unknown as
      | CaptureAccount[]
      | undefined;
    const created = (refreshed || []).find(
      (a) => a.name.toLowerCase() === pendingCategoryName.toLowerCase(),
    );
    if (!created) throw new Error('category');
    return created.id;
  };

  const handleSwitchBusiness = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextId = e.target.value;
    if (!nextId || nextId === organizationId) return;
    setCookie('organization_id', nextId);
    window.location.assign('/snap');
  };

  const handleSave = async () => {
    const problem = validateReceipt(values, !!photo);
    if (problem) {
      setError(problem);
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', photo as File);
      formData.append('internalKey', Date.now().toString());
      const uploaded = await uploadAttachment(formData);
      const key = (uploaded as { key?: string })?.key;
      if (!key) throw new Error('upload');

      const categoryAccountId = await resolveCategoryAccountId();
      await createExpense(
        buildExpenseRequest(
          values,
          key,
          categoryAccountId,
        ) as unknown as Parameters<typeof createExpense>[0],
      );
      // Remember the account, not the tag's new-category placeholder.
      saveLastUsed(organizationId, {
        categoryAccountId: String(categoryAccountId),
        paidFromAccountId: values.paidFromAccountId,
      });
      const invoice = openInvoices.find(
        (inv) => String(inv.id) === values.reimburseInvoiceId,
      );
      setSaved({
        amount: parseAmount(values.amount) as number,
        category:
          pendingCategoryName ||
          categories.find((a) => String(a.id) === values.categoryAccountId)
            ?.name ||
          '',
        invoiceNo: invoice?.invoiceNo,
        jobName: clientJobs.find((j) => String(j.id) === values.projectId)
          ?.name,
        customerName: values.reimbursable
          ? customers.find((c) => String(c.id) === values.reimburseCustomerId)
              ?.displayName
          : undefined,
      });
    } catch (err) {
      const serverMessage = (
        err as { data?: { errors?: Array<{ message?: string | null }> } }
      )?.data?.errors?.[0]?.message;
      setError(
        serverMessage
          ? `The receipt was not saved. ${serverMessage}`
          : 'The receipt was not saved. Check your connection and try again.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSnapAnother = () => {
    setSaved(null);
    setPhoto(null);
    setValues(emptyValues());
  };

  const currency = organization?.metadata?.baseCurrency || 'USD';
  const formatMoney = (amount: number) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(
      amount,
    );

  return (
    <Screen>
      <PhoneLayout />
      <Header>
        <BackLink to="/expenses" aria-label="Back to expenses">
          <Icon icon="arrow-left" />
        </BackLink>
        <Title>Snap a receipt</Title>
      </Header>

      <Body>
        {workspaces.length > 1 && (
          <FormGroup label="Business" labelFor="receipt-business">
            <HTMLSelect
              id="receipt-business"
              fill
              large
              value={organizationId || ''}
              onChange={handleSwitchBusiness}
              options={workspaces.map((w) => ({
                value: w.organizationId,
                label: w.metadata?.name || w.organizationId,
              }))}
            />
          </FormGroup>
        )}
        {workspaces.length <= 1 && organization?.metadata?.name && (
          <BusinessName>{organization.metadata.name}</BusinessName>
        )}

        {saved ? (
          <SavedPanel>
            <Icon icon="tick-circle" size={40} intent={Intent.SUCCESS} />
            <SavedAmount>{formatMoney(saved.amount)}</SavedAmount>
            <div>Saved to {saved.category || 'expenses'} with the photo.</div>
            {saved.invoiceNo && (
              <div>
                Added to invoice {saved.invoiceNo}
                {saved.customerName ? ` for ${saved.customerName}` : ''}, with
                the receipt attached.
              </div>
            )}
            {!saved.invoiceNo && saved.jobName && (
              <div>
                Added to the {saved.jobName} job for {saved.customerName}. It
                goes on the job's next invoice.
              </div>
            )}
            {!saved.invoiceNo && !saved.jobName && saved.customerName && (
              <div>
                Marked to bill back to {saved.customerName}. It is not on an
                invoice yet.
              </div>
            )}
            <Button
              large
              fill
              intent={Intent.PRIMARY}
              icon="camera"
              onClick={handleSnapAnother}
            >
              Snap another receipt
            </Button>
            <Link to="/expenses">See all expenses</Link>
          </SavedPanel>
        ) : (
          <>
            <input
              ref={fileInputRef}
              id="receipt-photo"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhoto}
              hidden
            />
            {photoUrl ? (
              <PhotoPreview>
                <img src={photoUrl} alt="Captured receipt" />
                <Button
                  icon="camera"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Retake
                </Button>
              </PhotoPreview>
            ) : (
              <PhotoButton
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                <Icon icon="camera" size={32} />
                <span>Take a photo of the receipt</span>
              </PhotoButton>
            )}

            <FormGroup label="Total" labelFor="receipt-amount">
              <InputGroup
                id="receipt-amount"
                large
                inputMode="decimal"
                placeholder="0.00"
                leftIcon="dollar"
                value={values.amount}
                onChange={setField('amount')}
              />
            </FormGroup>

            <FormGroup label="What was it for?">
              <TagChoices role="radiogroup" aria-label="What was it for?">
                {RECEIPT_TAG_OPTIONS.map((option) => (
                  <TagChoice
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={values.receiptTag === option.value}
                    data-selected={values.receiptTag === option.value}
                    onClick={() => handlePickTag(option.value)}
                  >
                    <Icon icon={option.icon as never} size={18} />
                    <span>{option.label}</span>
                  </TagChoice>
                ))}
              </TagChoices>
              {selectedTag && (
                <Hint>{TAX_TREATMENT_HINTS[selectedTag.taxTreatment]}</Hint>
              )}
            </FormGroup>

            <Row>
              <FormGroup label="Date" labelFor="receipt-date">
                <InputGroup
                  id="receipt-date"
                  type="date"
                  large
                  value={values.date}
                  onChange={setField('date')}
                />
              </FormGroup>
              <FormGroup label="Store or note" labelFor="receipt-description">
                <InputGroup
                  id="receipt-description"
                  large
                  placeholder="Home Depot, mulch"
                  value={values.description}
                  onChange={setField('description')}
                />
              </FormGroup>
            </Row>

            <FormGroup label="Category" labelFor="receipt-category">
              <HTMLSelect
                id="receipt-category"
                fill
                large
                disabled={isAccountsLoading}
                value={values.categoryAccountId}
                onChange={setField('categoryAccountId')}
                options={[
                  { value: '', label: 'Pick a category' },
                  ...(pendingCategoryName
                    ? [
                        {
                          value: values.categoryAccountId,
                          label: `${pendingCategoryName} (new category)`,
                        },
                      ]
                    : []),
                  ...categories.map((a) => ({
                    value: String(a.id),
                    label: a.name,
                  })),
                ]}
              />
            </FormGroup>

            <FormGroup label="Paid with" labelFor="receipt-paid-from">
              <HTMLSelect
                id="receipt-paid-from"
                fill
                large
                disabled={isAccountsLoading}
                value={values.paidFromAccountId}
                onChange={setField('paidFromAccountId')}
                options={[
                  { value: '', label: 'Pick an account' },
                  ...paidFrom.map((a) => ({
                    value: String(a.id),
                    label: a.name,
                  })),
                ]}
              />
            </FormGroup>

            <FormGroup label="Bill it back to someone?">
              <Switch
                large
                checked={values.reimbursable}
                label="Reimbursable by a client"
                onChange={(e) => {
                  const checked = (e.target as HTMLInputElement).checked;
                  setError(null);
                  setValues((v) => ({
                    ...v,
                    reimbursable: checked,
                    ...(checked
                      ? {}
                      : {
                          reimburseCustomerId: '',
                          reimburseInvoiceId: '',
                          projectId: '',
                        }),
                  }));
                }}
              />
            </FormGroup>

            {values.reimbursable && (
              <ReimburseBox>
                <FormGroup label="Client" labelFor="receipt-customer">
                  <HTMLSelect
                    id="receipt-customer"
                    fill
                    large
                    value={values.reimburseCustomerId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setError(null);
                      setValues((v) => ({
                        ...v,
                        reimburseCustomerId: id,
                        reimburseInvoiceId: '',
                        projectId: '',
                      }));
                    }}
                    options={[
                      { value: '', label: 'Pick a client' },
                      ...customers.map((c) => ({
                        value: String(c.id),
                        label: c.displayName,
                      })),
                    ]}
                  />
                </FormGroup>
                {values.reimburseCustomerId && clientJobs.length > 0 && (
                  <FormGroup label="Job" labelFor="receipt-job">
                    <HTMLSelect
                      id="receipt-job"
                      fill
                      large
                      value={values.projectId}
                      onChange={setField('projectId')}
                      options={[
                        { value: '', label: 'No specific job' },
                        ...clientJobs.map((j) => ({
                          value: String(j.id),
                          label: j.name,
                        })),
                      ]}
                    />
                  </FormGroup>
                )}
                {values.reimburseCustomerId && (
                  <FormGroup
                    label="Add to invoice"
                    labelFor="receipt-invoice"
                    helperText={
                      values.reimburseInvoiceId
                        ? 'The receipt goes on the invoice as a line item, with the photo attached.'
                        : values.projectId
                          ? "It will be on the job's next invoice."
                          : 'You can add it to an invoice later.'
                    }
                  >
                    <HTMLSelect
                      id="receipt-invoice"
                      fill
                      large
                      disabled={isInvoicesFetching}
                      value={values.reimburseInvoiceId}
                      onChange={setField('reimburseInvoiceId')}
                      options={[
                        { value: '', label: 'Not yet' },
                        ...openInvoices.map((inv) => ({
                          value: String(inv.id),
                          label: `${inv.invoiceNo || `Invoice ${inv.id}`}${
                            inv.isDelivered ? '' : ' (draft)'
                          }${inv.totalFormatted ? ` · ${inv.totalFormatted}` : ''}`,
                        })),
                      ]}
                    />
                  </FormGroup>
                )}
              </ReimburseBox>
            )}

            {error && <Callout intent={Intent.DANGER}>{error}</Callout>}
          </>
        )}
      </Body>

      {!saved && (
        <Footer>
          <Button
            large
            fill
            intent={Intent.PRIMARY}
            onClick={handleSave}
            disabled={isSaving}
            icon={isSaving ? <Spinner size={16} /> : 'floppy-disk'}
          >
            {isSaving ? 'Saving…' : 'Save receipt'}
          </Button>
        </Footer>
      )}
    </Screen>
  );
}

/**
 * The dashboard is laid out for desktop (fixed minimum width, page scroll
 * disabled). Lift both while this phone screen is shown.
 */
const PhoneLayout = createGlobalStyle`
  body {
    overflow: auto;
  }
  .App {
    min-width: 0;
  }
`;

const Screen = styled.div`
  min-height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-app-body, #f5f6f8);
  max-width: 560px;
  margin: 0 auto;
`;

const Header = styled.header`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px max(16px, env(safe-area-inset-left, 0px)) 8px;
`;

const BackLink = styled(Link)`
  display: inline-flex;
  padding: 8px;
  margin-left: -8px;
  color: inherit;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 22px;
  font-weight: 600;
`;

const Body = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px max(16px, env(safe-area-inset-right, 0px)) 24px
    max(16px, env(safe-area-inset-left, 0px));

  .bp4-form-group {
    margin-bottom: 12px;
  }
`;

const BusinessName = styled.div`
  font-size: 14px;
  opacity: 0.7;
  margin-bottom: 8px;
`;

const PhotoButton = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 170px;
  margin-bottom: 16px;
  border: 2px dashed var(--color-primary, #2d72d2);
  border-radius: 12px;
  background: transparent;
  color: inherit;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--color-primary, #2d72d2);
    outline-offset: 2px;
  }
`;

const PhotoPreview = styled.div`
  position: relative;
  margin-bottom: 16px;
  border-radius: 12px;
  overflow: hidden;

  img {
    display: block;
    width: 100%;
    max-height: 260px;
    object-fit: cover;
  }

  .bp4-button {
    position: absolute;
    right: 10px;
    bottom: 10px;
  }
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 12px;

  @media (max-width: 380px) {
    grid-template-columns: 1fr;
  }
`;

const TagChoices = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;

  @media (max-width: 340px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const TagChoice = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 64px;
  padding: 6px 4px;
  border-radius: 10px;
  border: 1px solid rgba(128, 128, 128, 0.45);
  background: transparent;
  color: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.2;
  text-align: center;
  cursor: pointer;

  .bp4-icon {
    color: #5f6b7c;
  }

  &[data-selected='true'] {
    border-color: #2d72d2;
    background: #2d72d2;
    color: #fff;

    .bp4-icon {
      color: #fff;
    }
  }

  &:focus-visible {
    outline: 2px solid #2d72d2;
    outline-offset: 2px;
  }
`;

const ReimburseBox = styled.div`
  margin: -4px 0 12px;
  padding: 12px 12px 0;
  border-radius: 10px;
  border: 1px solid rgba(128, 128, 128, 0.3);
`;

const Hint = styled.div`
  margin-top: 6px;
  font-size: 13px;
  opacity: 0.7;
`;

const Footer = styled.footer`
  position: sticky;
  bottom: 0;
  padding: 12px max(16px, env(safe-area-inset-right, 0px))
    calc(12px + env(safe-area-inset-bottom, 0px))
    max(16px, env(safe-area-inset-left, 0px));
  background: var(--color-app-body, #f5f6f8);
  border-top: 1px solid rgba(128, 128, 128, 0.25);
`;

const SavedPanel = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px 0;
  text-align: center;
`;

const SavedAmount = styled.div`
  font-size: 32px;
  font-weight: 600;
`;
