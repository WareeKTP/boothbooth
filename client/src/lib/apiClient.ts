import type { ApiErrorBody } from './types';

/**
 * Every API call is a relative `/api/...` path — no base URL, ever. Dev uses
 * the Vite proxy (vite.config.ts), prod uses nginx. Same-origin in both,
 * per frontend-final.md §1/§9 and backend-final.md §0.1.
 *
 * Envelope: success `{ data: T }`, error `{ error: { code, message, details? } }`
 * (backend-final.md §3 preamble). This file is the one place that unwraps it.
 */

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.code = body.code;
    this.status = status;
    this.details = body.details;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: opts.method ?? 'GET',
    credentials: 'same-origin', // cookie session auth, per backend-final.md §4.1
    headers: {
      ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...opts.headers,
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  // 204 No Content (logout, password change) — no body to parse.
  if (res.status === 204) {
    return undefined as T;
  }

  const json = (await res.json().catch(() => null)) as { data?: T; error?: ApiErrorBody } | null;

  if (!res.ok) {
    const errBody: ApiErrorBody = json?.error ?? {
      code: 'unknown_error',
      message: `Request failed with status ${res.status}`,
    };
    throw new ApiError(res.status, errBody);
  }

  return (json?.data ?? (json as unknown as T)) as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),

  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),

  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),

  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),

  /**
   * POST with a required `Idempotency-Key` header — used for checkout and
   * restock-fulfill (backend-final.md §4.3). The caller generates the UUID
   * once per logical attempt (see useCheckout/useFulfillRestock) and passes
   * it in; this function never generates one itself, so automatic React
   * Query retries replay the same key instead of minting a fresh one.
   */
  postIdempotent: <T>(path: string, body: unknown, idempotencyKey: string) =>
    request<T>(path, {
      method: 'POST',
      body,
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
};
