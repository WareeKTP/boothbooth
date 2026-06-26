import { useQuery, type QueryKey } from '@tanstack/react-query';
import { apiClient } from '../apiClient';

/** Shared shape for the several hooks that are just `useQuery` + a GET path, nothing else. */
export function useApiQuery<T>(queryKey: QueryKey, path: string, refetchInterval?: number) {
  return useQuery({ queryKey, queryFn: () => apiClient.get<T>(path), refetchInterval });
}
