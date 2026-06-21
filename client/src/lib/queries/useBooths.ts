import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../apiClient';
import type { BoothDetailDTO, BoothListRow } from '../types';
import { queryKeys } from './keys';

export function useBooths() {
  return useQuery({
    queryKey: queryKeys.booths,
    queryFn: () => apiClient.get<BoothListRow[]>('/booths'),
    refetchInterval: 15_000,
  });
}

export function useBoothDetail(boothId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.boothDetail(boothId ?? ''),
    queryFn: () => apiClient.get<BoothDetailDTO>(`/booths/${boothId}`),
    enabled: Boolean(boothId),
    refetchInterval: 15_000,
  });
}

export function useMyBooth() {
  return useQuery({
    queryKey: queryKeys.myBooth,
    queryFn: () => apiClient.get<BoothDetailDTO>('/me/booth'),
    refetchInterval: 15_000,
  });
}
