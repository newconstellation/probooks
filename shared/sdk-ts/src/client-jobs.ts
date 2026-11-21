import type { ApiFetcher } from './fetch-utils';
import { paths } from './schema';
import { OpForPath, OpRequestBody } from './utils';

export const CLIENT_JOBS_ROUTES = {
  LIST: '/api/jobs',
  BY_ID: '/api/jobs/{id}',
  LABOR: '/api/jobs/{id}/labor',
  LABOR_BY_ID: '/api/jobs/labor/{entryId}',
  EXPENSES: '/api/jobs/{id}/expenses',
  INVOICE: '/api/jobs/{id}/invoice',
} as const satisfies Record<string, keyof paths>;

export type CreateClientJobBody = OpRequestBody<OpForPath<typeof CLIENT_JOBS_ROUTES.LIST, 'post'>>;
export type EditClientJobBody = OpRequestBody<OpForPath<typeof CLIENT_JOBS_ROUTES.BY_ID, 'put'>>;
export type CreateClientJobLaborBody = OpRequestBody<OpForPath<typeof CLIENT_JOBS_ROUTES.LABOR, 'post'>>;
export type EditClientJobLaborBody = OpRequestBody<OpForPath<typeof CLIENT_JOBS_ROUTES.LABOR_BY_ID, 'put'>>;

export type ClientJobStatus = 'active' | 'completed';
export type ClientJobLaborType = 'hours' | 'days';

export interface ClientJob {
  id: number;
  name: string;
  clientId: number;
  clientName?: string;
  status: ClientJobStatus;
  hourlyRate: number | null;
  dayRate: number | null;
  overtimeBillable: boolean;
  overtimeRate: number | null;
  effectiveOvertimeRate: number;
  deadline?: string | null;
  notes?: string | null;
  createdAt?: string;
  unbilledHours: number;
  unbilledOvertimeHours: number;
  unbilledDays: number;
  unbilledLaborAmount: number;
  unbilledExpensesAmount: number;
  unbilledAmount: number;
  billedAmount: number;
}

export interface ClientJobLaborEntry {
  id: number;
  projectId: number;
  date: string;
  entryType: ClientJobLaborType;
  quantity: number;
  overtimeHours: number;
  rate: number;
  overtimeRate: number;
  amount: number;
  description?: string | null;
  invoiceId?: number | null;
}

export interface ClientJobExpense {
  id: number;
  paymentDate: string;
  description?: string | null;
  totalAmount: number;
  receiptTag?: string | null;
  reimbursable?: boolean;
  reimburseInvoiceId?: number | null;
  isPublished: boolean;
  attachmentsCount: number;
}

export interface GetClientJobsQuery {
  client_id?: number;
  status?: ClientJobStatus;
}

type AnyCall = (params?: unknown) => Promise<{ data: unknown }>;

export async function fetchClientJobs(fetcher: ApiFetcher, query?: GetClientJobsQuery): Promise<ClientJob[]> {
  const get = fetcher.path(CLIENT_JOBS_ROUTES.LIST).method('get').create() as unknown as AnyCall;
  const { data } = await get(query ?? {});
  return data as ClientJob[];
}

export async function fetchClientJob(fetcher: ApiFetcher, id: number): Promise<ClientJob> {
  const get = fetcher.path(CLIENT_JOBS_ROUTES.BY_ID).method('get').create() as unknown as AnyCall;
  const { data } = await get({ id });
  return data as ClientJob;
}

export async function createClientJob(fetcher: ApiFetcher, values: CreateClientJobBody): Promise<ClientJob> {
  const post = fetcher.path(CLIENT_JOBS_ROUTES.LIST).method('post').create() as unknown as AnyCall;
  const { data } = await post(values);
  return data as ClientJob;
}

export async function editClientJob(fetcher: ApiFetcher, id: number, values: EditClientJobBody): Promise<ClientJob> {
  const put = fetcher.path(CLIENT_JOBS_ROUTES.BY_ID).method('put').create() as unknown as AnyCall;
  const { data } = await put({ id, ...values });
  return data as ClientJob;
}

export async function deleteClientJob(fetcher: ApiFetcher, id: number): Promise<void> {
  const del = fetcher.path(CLIENT_JOBS_ROUTES.BY_ID).method('delete').create() as unknown as AnyCall;
  await del({ id });
}

export async function fetchClientJobLabor(fetcher: ApiFetcher, id: number): Promise<ClientJobLaborEntry[]> {
  const get = fetcher.path(CLIENT_JOBS_ROUTES.LABOR).method('get').create() as unknown as AnyCall;
  const { data } = await get({ id });
  return data as ClientJobLaborEntry[];
}

export async function createClientJobLabor(
  fetcher: ApiFetcher,
  id: number,
  values: CreateClientJobLaborBody
): Promise<ClientJobLaborEntry> {
  const post = fetcher.path(CLIENT_JOBS_ROUTES.LABOR).method('post').create() as unknown as AnyCall;
  const { data } = await post({ id, ...values });
  return data as ClientJobLaborEntry;
}

export async function editClientJobLabor(
  fetcher: ApiFetcher,
  entryId: number,
  values: EditClientJobLaborBody
): Promise<ClientJobLaborEntry> {
  const put = fetcher.path(CLIENT_JOBS_ROUTES.LABOR_BY_ID).method('put').create() as unknown as AnyCall;
  const { data } = await put({ entryId, ...values });
  return data as ClientJobLaborEntry;
}

export async function deleteClientJobLabor(fetcher: ApiFetcher, entryId: number): Promise<void> {
  const del = fetcher.path(CLIENT_JOBS_ROUTES.LABOR_BY_ID).method('delete').create() as unknown as AnyCall;
  await del({ entryId });
}

export async function fetchClientJobExpenses(fetcher: ApiFetcher, id: number): Promise<ClientJobExpense[]> {
  const get = fetcher.path(CLIENT_JOBS_ROUTES.EXPENSES).method('get').create() as unknown as AnyCall;
  const { data } = await get({ id });
  return data as ClientJobExpense[];
}

export async function invoiceClientJob(fetcher: ApiFetcher, id: number): Promise<{ invoiceId: number }> {
  const post = fetcher.path(CLIENT_JOBS_ROUTES.INVOICE).method('post').create() as unknown as AnyCall;
  const { data } = await post({ id });
  return data as { invoiceId: number };
}
