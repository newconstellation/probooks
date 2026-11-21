import {
  Button,
  Callout,
  Classes,
  Dialog,
  FormGroup,
  HTMLSelect,
  InputGroup,
  Intent,
  Switch,
  TextArea,
} from '@blueprintjs/core';
import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useMoney } from './useMoney';
import {
  emptyJobForm,
  JobFormValues,
  jobFormToRequest,
  jobToForm,
  OVERTIME_MULTIPLIER,
  parseNumber,
  validateJobForm,
} from './utils';
import type { ClientJob as Job } from '@bigcapital/sdk-ts';
import {
  useCreateClientJob,
  useEditClientJob,
} from '@/hooks/query/client-jobs';
import { useCustomers } from '@/hooks/query/customers';

interface JobFormDialogProps {
  isOpen: boolean;
  job?: Job | null;
  defaultClientId?: string;
  onClose: () => void;
  onSaved?: (job: Job) => void;
}

/**
 * Create or edit a client job and its billing rates.
 */
export function JobFormDialog({
  isOpen,
  job,
  defaultClientId,
  onClose,
  onSaved,
}: JobFormDialogProps) {
  const formatMoney = useMoney();
  const { data: customersData } = useCustomers(
    { page_size: 500 },
    { enabled: isOpen },
  );
  const clients = (customersData?.data || []) as Array<{
    id: number;
    displayName: string;
  }>;
  const { mutateAsync: createJob, isPending: isCreating } =
    useCreateClientJob();
  const { mutateAsync: editJob, isPending: isEditing } = useEditClientJob();

  const [values, setValues] = useState<JobFormValues>(emptyJobForm());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setValues(job ? jobToForm(job) : emptyJobForm(defaultClientId || ''));
    setError(null);
  }, [isOpen, job, defaultClientId]);

  const set =
    (field: keyof JobFormValues) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      setError(null);
      setValues((v) => ({ ...v, [field]: e.target.value }));
    };

  const hourly = parseNumber(values.hourlyRate);
  const overtimePlaceholder = hourly
    ? `${formatMoney(hourly * OVERTIME_MULTIPLIER)} (1.5× hourly)`
    : '1.5× the hourly rate';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateJobForm(values);
    if (problem) {
      setError(problem);
      return;
    }
    try {
      const body = jobFormToRequest(values) as never;
      const saved = job ? await editJob([job.id, body]) : await createJob(body);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      const message = (
        err as { data?: { errors?: Array<{ message?: string | null }> } }
      )?.data?.errors?.[0]?.message;
      setError(message || 'The job was not saved. Try again.');
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={job ? 'Edit job' : 'New job'}
      style={{ width: 520, maxWidth: 'calc(100vw - 32px)' }}
    >
      <form onSubmit={handleSubmit}>
        <div className={Classes.DIALOG_BODY}>
          <FormGroup label="Job name" labelFor="job-name">
            <InputGroup
              id="job-name"
              autoFocus
              placeholder="Lobby renovation"
              value={values.name}
              onChange={set('name')}
            />
          </FormGroup>
          <FormGroup label="Client" labelFor="job-client">
            <HTMLSelect
              id="job-client"
              fill
              value={values.clientId}
              onChange={set('clientId')}
              options={[
                { value: '', label: 'Pick a client' },
                ...clients.map((c) => ({
                  value: String(c.id),
                  label: c.displayName,
                })),
              ]}
            />
          </FormGroup>
          <Row>
            <FormGroup label="Hourly rate" labelFor="job-hourly-rate">
              <InputGroup
                id="job-hourly-rate"
                inputMode="decimal"
                leftIcon="dollar"
                placeholder="0.00"
                value={values.hourlyRate}
                onChange={set('hourlyRate')}
              />
            </FormGroup>
            <FormGroup label="Day rate" labelFor="job-day-rate">
              <InputGroup
                id="job-day-rate"
                inputMode="decimal"
                leftIcon="dollar"
                placeholder="0.00"
                value={values.dayRate}
                onChange={set('dayRate')}
              />
            </FormGroup>
          </Row>
          <FormGroup>
            <Switch
              checked={values.overtimeBillable}
              label="Bill overtime on this job"
              onChange={(e) => {
                const checked = (e.target as HTMLInputElement).checked;
                setValues((v) => ({ ...v, overtimeBillable: checked }));
              }}
            />
          </FormGroup>
          {values.overtimeBillable && (
            <FormGroup
              label="Overtime rate"
              labelFor="job-overtime-rate"
              helperText="Leave empty to bill 1.5× the hourly rate."
            >
              <InputGroup
                id="job-overtime-rate"
                inputMode="decimal"
                leftIcon="dollar"
                placeholder={overtimePlaceholder}
                value={values.overtimeRate}
                onChange={set('overtimeRate')}
              />
            </FormGroup>
          )}
          {job && (
            <FormGroup label="Status" labelFor="job-status">
              <HTMLSelect
                id="job-status"
                fill
                value={values.status}
                onChange={set('status')}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'completed', label: 'Completed' },
                ]}
              />
            </FormGroup>
          )}
          <FormGroup label="Notes" labelFor="job-notes">
            <TextArea
              id="job-notes"
              fill
              rows={2}
              value={values.notes}
              onChange={set('notes')}
            />
          </FormGroup>
          {error && <Callout intent={Intent.DANGER}>{error}</Callout>}
        </div>
        <div className={Classes.DIALOG_FOOTER}>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              intent={Intent.PRIMARY}
              loading={isCreating || isEditing}
            >
              {job ? 'Save' : 'Create job'}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

const Row = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
`;
