/**
 * Account read model — builds the AccountDTO shape the client expects
 * (backend-final.md §3.2 / client types.ts AccountDTO).
 */
import { query } from '../db/pool.js';
import type { Role } from '../types.js';

export interface AccountDTO {
  id: string;
  role: Role;
  fullName: string;
  email: string;
  phone: string | null;
  booth: { id: string; code: string; name: string; location: string } | null;
  prefs: { notifyLowStock: boolean; notifyDailySummary: boolean };
  expo: { id: string; name: string; currency: string; startsOn: string; endsOn: string };
}

interface AccountRow {
  id: string;
  role: Role;
  full_name: string;
  email: string;
  phone: string | null;
  notify_low_stock: boolean;
  notify_daily_summary: boolean;
  booth_id: string | null;
  booth_code: string | null;
  booth_name: string | null;
  booth_location: string | null;
  expo_id: string;
  expo_name: string;
  expo_currency: string;
  expo_starts_on: string;
  expo_ends_on: string;
}

const ACCOUNT_DTO_SQL = `
  SELECT a.id, a.role, a.full_name, a.email, a.phone,
         a.notify_low_stock, a.notify_daily_summary,
         b.id   AS booth_id, b.code AS booth_code, b.name AS booth_name, b.location AS booth_location,
         e.id   AS expo_id, e.name AS expo_name, e.currency AS expo_currency,
         to_char(e.starts_on, 'YYYY-MM-DD') AS expo_starts_on,
         to_char(e.ends_on,   'YYYY-MM-DD') AS expo_ends_on
  FROM accounts a
  JOIN expos  e ON e.id = a.expo_id
  LEFT JOIN booths b ON b.id = a.booth_id
  WHERE a.id = $1 AND a.is_active = true
`;

function toDTO(r: AccountRow): AccountDTO {
  return {
    id: r.id,
    role: r.role,
    fullName: r.full_name,
    email: r.email,
    phone: r.phone,
    booth: r.booth_id
      ? { id: r.booth_id, code: r.booth_code!, name: r.booth_name!, location: r.booth_location! }
      : null,
    prefs: {
      notifyLowStock: r.notify_low_stock,
      notifyDailySummary: r.notify_daily_summary,
    },
    expo: {
      id: r.expo_id,
      name: r.expo_name,
      currency: r.expo_currency,
      startsOn: r.expo_starts_on,
      endsOn: r.expo_ends_on,
    },
  };
}

export async function getAccountDTO(accountId: string): Promise<AccountDTO | null> {
  const res = await query<AccountRow>(ACCOUNT_DTO_SQL, [accountId]);
  return res.rows[0] ? toDTO(res.rows[0]) : null;
}
