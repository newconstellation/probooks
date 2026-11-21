import { useCallback } from 'react';
import { useCurrentOrganization } from '@/hooks/query/organization';

/**
 * Formats amounts in the business's base currency.
 */
export function useMoney() {
  const { data: organization } = useCurrentOrganization();
  const currency = organization?.metadata?.baseCurrency || 'USD';
  return useCallback(
    (amount: number | string | null | undefined) =>
      new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(
        Number(amount || 0),
      ),
    [currency],
  );
}
