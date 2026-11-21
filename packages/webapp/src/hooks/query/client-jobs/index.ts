import {
  createClientJob,
  createClientJobLabor,
  deleteClientJob,
  deleteClientJobLabor,
  editClientJob,
  editClientJobLabor,
  fetchClientJob,
  fetchClientJobExpenses,
  fetchClientJobLabor,
  fetchClientJobs,
  invoiceClientJob,
} from '@bigcapital/sdk-ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiFetcher } from '../../useRequest';
import type {
  CreateClientJobBody,
  CreateClientJobLaborBody,
  EditClientJobBody,
  EditClientJobLaborBody,
  GetClientJobsQuery,
} from '@bigcapital/sdk-ts';

export const clientJobsKeys = {
  all: () => ['client-jobs'] as const,
  list: (query?: GetClientJobsQuery) =>
    ['client-jobs', 'list', query ?? {}] as const,
  detail: (id: number) => ['client-jobs', 'detail', id] as const,
  labor: (id: number) => ['client-jobs', 'labor', id] as const,
  expenses: (id: number) => ['client-jobs', 'expenses', id] as const,
};

function useInvalidateClientJobs() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: clientJobsKeys.all() });
    // Billing a job changes invoices and expenses too.
    queryClient.invalidateQueries({ queryKey: ['SALE_INVOICES'] });
    queryClient.invalidateQueries({ queryKey: ['EXPENSES'] });
  };
}

export function useClientJobs(
  query?: GetClientJobsQuery,
  options?: { enabled?: boolean },
) {
  const fetcher = useApiFetcher({ enableCamelCaseTransform: true });
  return useQuery({
    queryKey: clientJobsKeys.list(query),
    queryFn: () => fetchClientJobs(fetcher, query),
    enabled: options?.enabled ?? true,
  });
}

export function useClientJob(id: number | null | undefined) {
  const fetcher = useApiFetcher({ enableCamelCaseTransform: true });
  return useQuery({
    queryKey: clientJobsKeys.detail(id as number),
    queryFn: () => fetchClientJob(fetcher, id as number),
    enabled: !!id,
  });
}

export function useClientJobLabor(id: number | null | undefined) {
  const fetcher = useApiFetcher({ enableCamelCaseTransform: true });
  return useQuery({
    queryKey: clientJobsKeys.labor(id as number),
    queryFn: () => fetchClientJobLabor(fetcher, id as number),
    enabled: !!id,
  });
}

export function useClientJobExpenses(id: number | null | undefined) {
  const fetcher = useApiFetcher({ enableCamelCaseTransform: true });
  return useQuery({
    queryKey: clientJobsKeys.expenses(id as number),
    queryFn: () => fetchClientJobExpenses(fetcher, id as number),
    enabled: !!id,
  });
}

export function useCreateClientJob() {
  const fetcher = useApiFetcher({ enableCamelCaseTransform: true });
  const invalidate = useInvalidateClientJobs();
  return useMutation({
    mutationFn: (values: CreateClientJobBody) =>
      createClientJob(fetcher, values),
    onSuccess: invalidate,
  });
}

export function useEditClientJob() {
  const fetcher = useApiFetcher({ enableCamelCaseTransform: true });
  const invalidate = useInvalidateClientJobs();
  return useMutation({
    mutationFn: ([id, values]: [number, EditClientJobBody]) =>
      editClientJob(fetcher, id, values),
    onSuccess: invalidate,
  });
}

export function useDeleteClientJob() {
  const fetcher = useApiFetcher();
  const invalidate = useInvalidateClientJobs();
  return useMutation({
    mutationFn: (id: number) => deleteClientJob(fetcher, id),
    onSuccess: invalidate,
  });
}

export function useCreateClientJobLabor() {
  const fetcher = useApiFetcher({ enableCamelCaseTransform: true });
  const invalidate = useInvalidateClientJobs();
  return useMutation({
    mutationFn: ([id, values]: [number, CreateClientJobLaborBody]) =>
      createClientJobLabor(fetcher, id, values),
    onSuccess: invalidate,
  });
}

export function useEditClientJobLabor() {
  const fetcher = useApiFetcher({ enableCamelCaseTransform: true });
  const invalidate = useInvalidateClientJobs();
  return useMutation({
    mutationFn: ([entryId, values]: [number, EditClientJobLaborBody]) =>
      editClientJobLabor(fetcher, entryId, values),
    onSuccess: invalidate,
  });
}

export function useDeleteClientJobLabor() {
  const fetcher = useApiFetcher();
  const invalidate = useInvalidateClientJobs();
  return useMutation({
    mutationFn: (entryId: number) => deleteClientJobLabor(fetcher, entryId),
    onSuccess: invalidate,
  });
}

export function useInvoiceClientJob() {
  const fetcher = useApiFetcher({ enableCamelCaseTransform: true });
  const invalidate = useInvalidateClientJobs();
  return useMutation({
    mutationFn: (id: number) => invoiceClientJob(fetcher, id),
    onSuccess: invalidate,
  });
}
