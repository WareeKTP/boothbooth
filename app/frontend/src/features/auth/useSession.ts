import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '../../lib/apiClient';
import { queryKeys } from '../../lib/queries/keys';
import type { AccountDTO } from '../../lib/types';

interface LoginInput {
  email: string;
  password: string;
}

/**
 * Bootstraps the SPA on load via GET /api/auth/me (backend-final.md §3.2).
 * Also exposes expo.currency and prefs, since AccountDTO carries both.
 * 401 is treated as "logged out", not an error to throw at the user.
 *
 * Response shape is `{ data: { account: AccountDTO } }` — same envelope as
 * POST /auth/login — so the unwrapped `data` here is `{ account }`, not the
 * account itself. Pull `.account` out so the cached value matches what
 * useLogin's onSuccess stores (`data.account`) and what every consumer
 * (AppShell, RequireAuth, etc.) expects from `account.role`/`account.booth`.
 */
export function useSession() {
  const query = useQuery({
    queryKey: queryKeys.session,
    queryFn: () => apiClient.get<{ account: AccountDTO }>('/auth/me').then((res) => res.account),
    retry: false,
    staleTime: 60_000,
  });

  const isUnauthenticated = query.isError && query.error instanceof ApiError && query.error.status === 401;

  return {
    ...query,
    account: query.data,
    isUnauthenticated,
  };
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => apiClient.post<{ account: AccountDTO }>('/auth/login', input),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.session, data.account);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<void>('/auth/logout'),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
