import {
  Button,
  Callout,
  FormGroup,
  HTMLSelect,
  Icon,
  InputGroup,
  Intent,
  Spinner,
} from '@blueprintjs/core';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import styled, { createGlobalStyle } from 'styled-components';
import {
  buildExpenseRequest,
  CaptureAccount,
  groupCaptureAccounts,
  loadLastUsed,
  parseAmount,
  ReceiptCaptureValues,
  saveLastUsed,
  TAX_TREATMENT_OPTIONS,
  todayISO,
  validateReceipt,
} from './utils';
import { useWorkspaces } from '@/ee/workspaces/hooks/query';
import { useAccounts } from '@/hooks/query/accounts';
import { useUploadAttachments } from '@/hooks/query/attachments';
import { useCreateExpense } from '@/hooks/query/expenses';
import { useCurrentOrganization } from '@/hooks/query/organization';
import { useAuthOrganizationId } from '@/hooks/state';
import { setCookie } from '@/utils';

interface SavedReceipt {
  amount: number;
  category: string;
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
      taxTreatment: 'deductible',
    };
  };
  const [values, setValues] = useState<ReceiptCaptureValues>(emptyValues);
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
      categoryAccountId: categories.some(
        (a) => String(a.id) === v.categoryAccountId,
      )
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

      await createExpense(
        buildExpenseRequest(values, key) as unknown as Parameters<
          typeof createExpense
        >[0],
      );
      saveLastUsed(organizationId, {
        categoryAccountId: values.categoryAccountId,
        paidFromAccountId: values.paidFromAccountId,
      });
      setSaved({
        amount: parseAmount(values.amount) as number,
        category:
          categories.find((a) => String(a.id) === values.categoryAccountId)
            ?.name || '',
      });
    } catch {
      setError(
        'The receipt was not saved. Check your connection and try again.',
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

            <FormGroup label="For taxes">
              <TaxChoices role="radiogroup" aria-label="For taxes">
                {TAX_TREATMENT_OPTIONS.map((option) => (
                  <TaxChoice
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={values.taxTreatment === option.value}
                    data-selected={values.taxTreatment === option.value}
                    onClick={() =>
                      setValues((v) => ({ ...v, taxTreatment: option.value }))
                    }
                  >
                    {option.label}
                  </TaxChoice>
                ))}
              </TaxChoices>
              <Hint>
                {
                  TAX_TREATMENT_OPTIONS.find(
                    (o) => o.value === values.taxTreatment,
                  )?.hint
                }
              </Hint>
            </FormGroup>

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

const TaxChoices = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
`;

const TaxChoice = styled.button`
  min-height: 44px;
  border-radius: 8px;
  border: 1px solid rgba(128, 128, 128, 0.45);
  background: transparent;
  color: inherit;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;

  &[data-selected='true'] {
    border-color: #2d72d2;
    background: #2d72d2;
    color: #fff;
  }

  &:focus-visible {
    outline: 2px solid #2d72d2;
    outline-offset: 2px;
  }
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
