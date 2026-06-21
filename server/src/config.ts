/**
 * Centralized env config. Reads ONLY the env vars defined in infra-final.md §5.
 * No new env vars invented. Fails fast with a clear message if a required var is
 * missing, so a misconfigured container dies at boot instead of serving errors.
 */

function required(name: string): string {
  const v = process.env[name];
  if (v === undefined || v === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function optional(name: string, fallback: string): string {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

export interface AppConfig {
  databaseUrl: string;
  databaseUrlMigrate: string;
  port: number;
  nodeEnv: string;
  isProd: boolean;
  sessionCookieSecret: string;
  cookieSecure: boolean;
  expoTz: string;
}

let cached: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cached) return cached;

  const nodeEnv = optional('NODE_ENV', 'development');
  // DATABASE_URL_MIGRATE is only consumed by the migrate job; the api process
  // doesn't strictly need it. Read it optionally so the api can boot without it,
  // but the migrate runner asserts it (see migrate.ts).
  cached = {
    databaseUrl: required('DATABASE_URL'),
    databaseUrlMigrate: optional('DATABASE_URL_MIGRATE', ''),
    port: parseInt(optional('PORT', '4000'), 10),
    nodeEnv,
    isProd: nodeEnv === 'production',
    sessionCookieSecret: required('SESSION_COOKIE_SECRET'),
    cookieSecure: optional('COOKIE_SECURE', 'false') === 'true',
    expoTz: optional('EXPO_TZ', 'Africa/Lagos'),
  };
  return cached;
}
