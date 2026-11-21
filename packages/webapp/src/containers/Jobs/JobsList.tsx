import {
  Button,
  Classes,
  HTMLSelect,
  HTMLTable,
  Intent,
  NavbarDivider,
  NavbarGroup,
  NonIdealState,
  Spinner,
  Tag,
} from '@blueprintjs/core';
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import styled from 'styled-components';
import { JobFormDialog } from './JobFormDialog';
import { useMoney } from './useMoney';
import { describeRates } from './utils';
import type { ClientJobStatus as JobStatus } from '@bigcapital/sdk-ts';
import {
  Can,
  DashboardActionsBar,
  DashboardPageContent,
  Icon,
} from '@/components';
import { AbilitySubject, CustomerAction } from '@/constants/abilityOption';
import { useClientJobs } from '@/hooks/query/client-jobs';
import { useCustomers } from '@/hooks/query/customers';

/**
 * Every client's jobs with what is ready to bill.
 */
export function JobsList() {
  const history = useHistory();
  const formatMoney = useMoney();
  const [clientId, setClientId] = useState('');
  const [status, setStatus] = useState<JobStatus | ''>('active');
  const [isFormOpen, setFormOpen] = useState(false);

  const { data: jobs = [], isLoading } = useClientJobs({
    ...(clientId ? { client_id: Number(clientId) } : {}),
    ...(status ? { status } : {}),
  });
  const { data: customersData } = useCustomers({ page_size: 500 });
  const clients = (customersData?.data || []) as Array<{
    id: number;
    displayName: string;
  }>;

  return (
    <>
      <DashboardActionsBar>
        <NavbarGroup>
          <Can I={CustomerAction.Create} a={AbilitySubject.Customer}>
            <Button
              className={Classes.MINIMAL}
              icon={<Icon icon={'plus'} />}
              text={'New job'}
              onClick={() => setFormOpen(true)}
            />
            <NavbarDivider />
          </Can>
          <FilterSelect
            minimal
            aria-label="Client"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            options={[
              { value: '', label: 'All clients' },
              ...clients.map((c) => ({
                value: String(c.id),
                label: c.displayName,
              })),
            ]}
          />
          <FilterSelect
            minimal
            aria-label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as JobStatus | '')}
            options={[
              { value: 'active', label: 'Active jobs' },
              { value: 'completed', label: 'Completed jobs' },
              { value: '', label: 'All jobs' },
            ]}
          />
        </NavbarGroup>
      </DashboardActionsBar>

      <DashboardPageContent>
        <Content>
          {isLoading ? (
            <Spinner size={30} />
          ) : jobs.length === 0 ? (
            <NonIdealState
              icon="briefcase"
              title="No jobs yet"
              description="Create a job for a client to log labor, tag receipts and invoice the work."
              action={
                <Button
                  intent={Intent.PRIMARY}
                  onClick={() => setFormOpen(true)}
                >
                  New job
                </Button>
              }
            />
          ) : (
            <HTMLTable interactive className="jobs-table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Client</th>
                  <th>Rates</th>
                  <th className="num">Ready to bill</th>
                  <th className="num">Billed</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr
                    key={job.id}
                    onClick={() => history.push(`/jobs/${job.id}`)}
                    data-testid={`job-row-${job.id}`}
                  >
                    <td>
                      <strong>{job.name}</strong>
                      {job.status === 'completed' && (
                        <Tag minimal round style={{ marginLeft: 8 }}>
                          Completed
                        </Tag>
                      )}
                    </td>
                    <td>{job.clientName}</td>
                    <td className="muted">{describeRates(job, formatMoney)}</td>
                    <td className="num">
                      {job.unbilledAmount > 0 ? (
                        <strong>{formatMoney(job.unbilledAmount)}</strong>
                      ) : (
                        <span className="muted">-</span>
                      )}
                    </td>
                    <td className="num">{formatMoney(job.billedAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </HTMLTable>
          )}
        </Content>
      </DashboardPageContent>

      <JobFormDialog
        isOpen={isFormOpen}
        defaultClientId={clientId}
        onClose={() => setFormOpen(false)}
        onSaved={(job) => history.push(`/jobs/${job.id}`)}
      />
    </>
  );
}

const FilterSelect = styled(HTMLSelect)`
  margin-left: 4px;
`;

const Content = styled.div`
  padding: 20px;

  .jobs-table {
    width: 100%;
    background: var(--color-card-background, #fff);
    border-radius: 6px;
  }
  .jobs-table td,
  .jobs-table th {
    vertical-align: middle;
  }
  .num {
    text-align: right;
  }
  .muted {
    opacity: 0.65;
  }
`;
