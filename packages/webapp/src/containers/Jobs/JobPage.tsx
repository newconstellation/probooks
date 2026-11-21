import {
  Button,
  ButtonGroup,
  Callout,
  Card,
  FormGroup,
  HTMLTable,
  InputGroup,
  Intent,
  NonIdealState,
  Spinner,
  Tag,
} from '@blueprintjs/core';
import moment from 'moment';
import React, { useState } from 'react';
import { Link, useHistory, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { JobFormDialog } from './JobFormDialog';
import { useMoney } from './useMoney';
import {
  describeLabor,
  describeRates,
  LaborFormValues,
  laborFormToRequest,
  previewLaborAmount,
  validateLaborForm,
} from './utils';
import { DashboardPageContent, Icon } from '@/components';
import { getReceiptTagLabel } from '@/containers/ReceiptCapture/utils';
import {
  useCreateClientJobLabor,
  useDeleteClientJobLabor,
  useInvoiceClientJob,
  useClientJob,
  useClientJobExpenses,
  useClientJobLabor,
} from '@/hooks/query/client-jobs';

const serverError = (err: unknown) =>
  (err as { data?: { errors?: Array<{ message?: string | null }> } })?.data
    ?.errors?.[0]?.message;

const emptyLabor = (): LaborFormValues => ({
  date: moment().format('YYYY-MM-DD'),
  entryType: 'hours',
  quantity: '',
  overtimeHours: '',
  description: '',
});

/**
 * One job: its rates, labor log, expenses and the invoice button.
 */
export function JobPage() {
  const { id } = useParams<{ id: string }>();
  const jobId = Number(id);
  const history = useHistory();
  const formatMoney = useMoney();

  const { data: job, isLoading } = useClientJob(jobId);
  const { data: labor = [] } = useClientJobLabor(jobId);
  const { data: expenses = [] } = useClientJobExpenses(jobId);
  const { mutateAsync: createLabor, isPending: isLogging } =
    useCreateClientJobLabor();
  const { mutateAsync: deleteLabor } = useDeleteClientJobLabor();
  const { mutateAsync: invoiceJob, isPending: isInvoicing } =
    useInvoiceClientJob();

  const [isEditOpen, setEditOpen] = useState(false);
  const [laborValues, setLaborValues] = useState<LaborFormValues>(emptyLabor);
  const [laborError, setLaborError] = useState<string | null>(null);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <DashboardPageContent>
        <Spinner size={30} />
      </DashboardPageContent>
    );
  }
  if (!job) {
    return (
      <DashboardPageContent>
        <NonIdealState icon="search" title="Job not found" />
      </DashboardPageContent>
    );
  }

  const setLaborField =
    (field: keyof LaborFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLaborError(null);
      setLaborValues((v) => ({ ...v, [field]: e.target.value }));
    };

  const handleLogTime = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateLaborForm(laborValues);
    if (problem) {
      setLaborError(problem);
      return;
    }
    try {
      await createLabor([jobId, laborFormToRequest(laborValues) as never]);
      setLaborValues((v) => ({
        ...emptyLabor(),
        date: v.date,
        entryType: v.entryType,
      }));
    } catch (err) {
      setLaborError(serverError(err) || 'The time was not saved. Try again.');
    }
  };

  const handleInvoice = async () => {
    setInvoiceError(null);
    try {
      const { invoiceId } = await invoiceJob(jobId);
      history.push(`/invoices/${invoiceId}/edit`);
    } catch (err) {
      setInvoiceError(
        serverError(err) || 'The invoice was not created. Try again.',
      );
    }
  };

  const unbilledWork = [
    job.unbilledHours > 0 && `${job.unbilledHours} hrs`,
    job.unbilledOvertimeHours > 0 &&
      `${job.unbilledOvertimeHours} hrs overtime`,
    job.unbilledDays > 0 && `${job.unbilledDays} days`,
  ]
    .filter(Boolean)
    .join(', ');
  const preview = previewLaborAmount(job, laborValues);
  const canBillOvertime =
    job.overtimeBillable && laborValues.entryType === 'hours';

  return (
    <DashboardPageContent>
      <Page>
        <Header>
          <div>
            <Title>
              {job.name}
              <Tag
                minimal
                round
                intent={job.status === 'active' ? Intent.SUCCESS : Intent.NONE}
              >
                {job.status === 'active' ? 'Active' : 'Completed'}
              </Tag>
            </Title>
            <Subtitle>
              {job.clientName} · {describeRates(job, formatMoney)}
            </Subtitle>
          </div>
          <HeaderActions>
            <Button icon="edit" onClick={() => setEditOpen(true)}>
              Edit job
            </Button>
            <Button
              intent={Intent.PRIMARY}
              icon="document"
              disabled={job.unbilledAmount <= 0}
              loading={isInvoicing}
              onClick={handleInvoice}
            >
              {job.unbilledAmount > 0
                ? `Invoice ${formatMoney(job.unbilledAmount)}`
                : 'Nothing to invoice'}
            </Button>
          </HeaderActions>
        </Header>
        {invoiceError && (
          <Callout intent={Intent.DANGER}>{invoiceError}</Callout>
        )}

        <Tiles>
          <Tile>
            <TileLabel>Unbilled labor</TileLabel>
            <TileValue>{formatMoney(job.unbilledLaborAmount)}</TileValue>
            <TileHint>{unbilledWork || 'None'}</TileHint>
          </Tile>
          <Tile>
            <TileLabel>Unbilled expenses</TileLabel>
            <TileValue>{formatMoney(job.unbilledExpensesAmount)}</TileValue>
            <TileHint>Receipts tagged to this job</TileHint>
          </Tile>
          <Tile>
            <TileLabel>Billed so far</TileLabel>
            <TileValue>{formatMoney(job.billedAmount)}</TileValue>
            <TileHint>On invoices</TileHint>
          </Tile>
        </Tiles>

        <Section>
          <SectionTitle>Log time</SectionTitle>
          <LaborForm onSubmit={handleLogTime}>
            <FormGroup label="Date" labelFor="labor-date">
              <InputGroup
                id="labor-date"
                type="date"
                value={laborValues.date}
                onChange={setLaborField('date')}
              />
            </FormGroup>
            <FormGroup label="Billed by">
              <ButtonGroup>
                <Button
                  active={laborValues.entryType === 'hours'}
                  disabled={!job.hourlyRate}
                  onClick={() =>
                    setLaborValues((v) => ({ ...v, entryType: 'hours' }))
                  }
                >
                  Hours
                </Button>
                <Button
                  active={laborValues.entryType === 'days'}
                  disabled={!job.dayRate}
                  onClick={() =>
                    setLaborValues((v) => ({ ...v, entryType: 'days' }))
                  }
                >
                  Days
                </Button>
              </ButtonGroup>
            </FormGroup>
            <FormGroup
              label={laborValues.entryType === 'days' ? 'Days' : 'Hours'}
              labelFor="labor-quantity"
            >
              <InputGroup
                id="labor-quantity"
                inputMode="decimal"
                placeholder={laborValues.entryType === 'days' ? '1' : '8'}
                value={laborValues.quantity}
                onChange={setLaborField('quantity')}
              />
            </FormGroup>
            {canBillOvertime && (
              <FormGroup label="Overtime hours" labelFor="labor-overtime">
                <InputGroup
                  id="labor-overtime"
                  inputMode="decimal"
                  placeholder="0"
                  value={laborValues.overtimeHours}
                  onChange={setLaborField('overtimeHours')}
                />
              </FormGroup>
            )}
            <FormGroup label="Note" labelFor="labor-note" className="grow">
              <InputGroup
                id="labor-note"
                placeholder="Framing, drywall..."
                value={laborValues.description}
                onChange={setLaborField('description')}
              />
            </FormGroup>
            <FormGroup label=" ">
              <Button type="submit" intent={Intent.PRIMARY} loading={isLogging}>
                Add {preview > 0 ? formatMoney(preview) : ''}
              </Button>
            </FormGroup>
          </LaborForm>
          {laborError && <Callout intent={Intent.DANGER}>{laborError}</Callout>}

          {labor.length > 0 && (
            <HTMLTable compact className="job-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Work</th>
                  <th>Note</th>
                  <th className="num">Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {labor.map((entry) => (
                  <tr key={entry.id}>
                    <td>{moment(entry.date).format('MMM D, YYYY')}</td>
                    <td>{describeLabor(entry)}</td>
                    <td className="muted">{entry.description}</td>
                    <td className="num">{formatMoney(entry.amount)}</td>
                    <td className="num">
                      {entry.invoiceId ? (
                        <Link to={`/invoices/${entry.invoiceId}/edit`}>
                          Billed
                        </Link>
                      ) : (
                        <Button
                          minimal
                          small
                          icon="trash"
                          aria-label="Delete time"
                          onClick={() => deleteLabor(entry.id)}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </HTMLTable>
          )}
        </Section>

        <Section>
          <SectionHeader>
            <SectionTitle>Job expenses</SectionTitle>
            <Link to="/snap">
              <Icon icon="camera" iconSize={14} /> Snap a receipt
            </Link>
          </SectionHeader>
          {expenses.length === 0 ? (
            <Empty>
              No receipts yet. When you snap a receipt, turn on "Bill it back"
              and pick this job.
            </Empty>
          ) : (
            <HTMLTable compact className="job-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th className="num">Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>{moment(expense.paymentDate).format('MMM D, YYYY')}</td>
                    <td>
                      {expense.description || 'Receipt'}
                      {expense.attachmentsCount > 0 && (
                        <Icon
                          icon="paperclip"
                          iconSize={12}
                          style={{ marginLeft: 6, opacity: 0.6 }}
                        />
                      )}
                    </td>
                    <td className="muted">
                      {getReceiptTagLabel(expense.receiptTag)}
                    </td>
                    <td className="num">{formatMoney(expense.totalAmount)}</td>
                    <td className="num">
                      {expense.reimburseInvoiceId ? (
                        <Link
                          to={`/invoices/${expense.reimburseInvoiceId}/edit`}
                        >
                          Billed
                        </Link>
                      ) : expense.reimbursable ? (
                        <span className="muted">Unbilled</span>
                      ) : (
                        <span className="muted">Not billable</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </HTMLTable>
          )}
        </Section>
      </Page>

      <JobFormDialog
        isOpen={isEditOpen}
        job={job}
        onClose={() => setEditOpen(false)}
      />
    </DashboardPageContent>
  );
}

const Page = styled.div`
  padding: 20px;
  max-width: 1100px;
  display: flex;
  flex-direction: column;
  gap: 16px;

  .job-table {
    width: 100%;
    margin-top: 12px;
  }
  .num {
    text-align: right;
  }
  .muted {
    opacity: 0.65;
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
`;

const Title = styled.h2`
  margin: 0 0 4px;
  font-size: 22px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const Subtitle = styled.div`
  opacity: 0.7;
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 8px;
`;

const Tiles = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
`;

const Tile = styled(Card)`
  padding: 14px 16px;
`;

const TileLabel = styled.div`
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.65;
`;

const TileValue = styled.div`
  font-size: 22px;
  font-weight: 600;
  margin: 4px 0;
`;

const TileHint = styled.div`
  font-size: 13px;
  opacity: 0.65;
`;

const Section = styled(Card)`
  padding: 16px;
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const SectionTitle = styled.h3`
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
`;

const LaborForm = styled.form`
  display: flex;
  flex-wrap: wrap;
  gap: 0 12px;
  align-items: flex-end;

  .bp4-form-group {
    margin-bottom: 8px;
  }
  .grow {
    flex: 1 1 180px;
  }
`;

const Empty = styled.div`
  opacity: 0.7;
`;
