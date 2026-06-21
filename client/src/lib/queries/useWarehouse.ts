import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../apiClient';
import type { ReceiveStockResponse, WarehouseRow } from '../types';
import { queryKeys } from './keys';

export function useWarehouse() {
  return useQuery({
    queryKey: queryKeys.warehouse,
    queryFn: () => apiClient.get<WarehouseRow[]>('/warehouse'),
    refetchInterval: 15_000,
  });
}

interface ReceiveStockInput {
  productId: string;
  units: number;
  idempotencyKey: string;
}

/** Owner-only. Idempotency-Key required per backend-final.md §3.5. */
export function useReceiveStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, units, idempotencyKey }: ReceiveStockInput) =>
      apiClient.postIdempotent<ReceiveStockResponse>('/warehouse/receive', { productId, units }, idempotencyKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.warehouse });
    },
  });
}
