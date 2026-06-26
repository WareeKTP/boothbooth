/**
 * Shared server-side types. Augments Fastify's request with the authenticated
 * account context populated by the auth preHandler.
 */
import 'fastify';

export type Role = 'owner' | 'staff';

export interface AuthAccount {
  id: string;
  expoId: string;
  role: Role;
  /** Non-null only for staff. The authoritative booth for all staff scoping. */
  boothId: string | null;
  /** Raw session token for this request (needed to keep current session on pw change). */
  sessionToken: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Populated by the auth preHandler; absent on public routes. */
    account?: AuthAccount;
  }
}
