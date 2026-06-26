import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
import { queryKeys } from '../../lib/queries/keys';
import type { CheckoutItemReq, CheckoutResponse } from '../../lib/types';

interface CheckoutInput {
  items: CheckoutItemReq[];
  idempotencyKey: string;
}

/**
 * POST /api/sales — Idempotency-Key required (backend-final.md §3.6,
 * frontend-final.md §9). The key is generated once by the caller at the
 * moment "Confirm" is clicked, not inside this mutation function, so React
 * Query retries of the same attempt reuse it.
 */
export function useCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ items, idempotencyKey }: CheckoutInput) =>
      apiClient.postIdempotent<CheckoutResponse>('/sales', { items }, idempotencyKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.posCatalog });
      void queryClient.invalidateQueries({ queryKey: queryKeys.myBooth });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dailyLog });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
