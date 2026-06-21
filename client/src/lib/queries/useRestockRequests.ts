import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../apiClient';
import type { CreateRestockResponse, FulfillRestockResponse, RestockRequestRow } from '../types';
import { queryKeys } from './keys';

/** Owner: all booths. Staff: own booth only (server-scoped). backend-final.md §3.8. */
export function useRestockRequests() {
  return useQuery({
    queryKey: queryKeys.restockRequests,
    queryFn: () => apiClient.get<RestockRequestRow[]>('/restock-requests'),
    refetchInterval: 15_000,
  });
}

interface CreateRestockInput {
  productId: string;
  requestedQty: number;
}

/** Staff "Request restock" button. No Idempotency-Key — not money/stock-moving. */
export function useCreateRestockRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRestockInput) =>
      apiClient.post<CreateRestockResponse>('/restock-requests', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.restockRequests });
    },
  });
}

interface FulfillRestockInput {
  id: string;
  qty: number;
  idempotencyKey: string;
}

/**
 * Owner fulfill action. Idempotency-Key required (backend-final.md §3.8).
 * On success must invalidate restock-requests + warehouse + the affected
 * booth-detail/my-booth query — per frontend-final.md §6, three invalidations.
 *
 * DEVIATION from §6's literal wording: that section says to invalidate
 * "whichever booth-detail ... query corresponds to request.boothId" — but
 * backend-final.md §3.8's GET /api/restock-requests response shape only
 * returns `boothCode`, not `boothId` (confirmed in the contract, not a typo).
 * There's no boothId available client-side to target a single boothDetail
 * cache entry. Resolution: invalidate the parent `['booths']` key, which
 * React Query matches as a prefix against `boothDetail(id) = ['booths', id]`
 * too, so every open booth-detail view (plus the list) refetches — same
 * effect, no backend change required. Flagging here since it's the one
 * place this build deviates from the literal doc text.
 */
export function useFulfillRestockRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, qty, idempotencyKey }: FulfillRestockInput) =>
      apiClient.postIdempotent<FulfillRestockResponse>(`/restock-requests/${id}/fulfill`, { qty }, idempotencyKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.restockRequests });
      void queryClient.invalidateQueries({ queryKey: queryKeys.warehouse });
      void queryClient.invalidateQueries({ queryKey: queryKeys.booths });
      void queryClient.invalidateQueries({ queryKey: queryKeys.myBooth });
    },
  });
}
