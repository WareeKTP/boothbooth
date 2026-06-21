-- ============================================================================
-- BoothBooth — DB role provisioning (infra-final.md §6)
--
-- Runs ONCE on first cluster creation via /docker-entrypoint-initdb.d, as the
-- bootstrap superuser (POSTGRES_USER). Creates the two application roles:
--
--   bb_migrate : DDL/migration role. Owns the schema; may CREATE/ALTER/DROP and
--                CREATE EXTENSION. Used ONLY by the one-shot `migrate` job
--                (DATABASE_URL_MIGRATE).
--   bb_app     : runtime DML role. SELECT/INSERT/UPDATE/DELETE on app tables +
--                USAGE on sequences. NO DDL, NO DROP, NO extension rights.
--                Used ONLY by the `api` service (DATABASE_URL).
--
-- Passwords: this file is run by the official postgres image's init mechanism,
-- which executes /docker-entrypoint-initdb.d/*.sql via psql WITHOUT passing any
-- custom -v variables. So we use psql variables with a built-in default that is
-- safe when no -v is supplied (dev) and overridable when it is (prod):
--
--   psql -v bb_migrate_password='...' -v bb_app_password='...'
--
-- If infra prefers an envsubst-based .sh wrapper instead (recommended for prod —
-- see INFRA NOTE at bottom), it can pre-substitute these. The `\if :{?var}` guard
-- below sets a dev-only fallback ('change-me') ONLY when the variable is unset,
-- so this file runs cleanly with or without -v flags.
--
-- Least privilege: a compromised api process can only touch row data on app
-- tables — it cannot alter schema, drop tables, or install extensions.
-- ============================================================================

-- Default the password variables to a dev value if not provided via -v.
-- `:{?name}` is true when the variable is defined; psql ≥ 9.6 supports \if.
\if :{?bb_migrate_password} \else \set bb_migrate_password 'change-me' \endif
\if :{?bb_app_password} \else \set bb_app_password 'change-me' \endif

-- ── Migration / DDL role ───────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bb_migrate') THEN
    CREATE ROLE bb_migrate LOGIN;
  END IF;
END
$$;
ALTER ROLE bb_migrate WITH LOGIN PASSWORD :'bb_migrate_password';

-- ── Runtime DML role ───────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bb_app') THEN
    CREATE ROLE bb_app LOGIN;
  END IF;
END
$$;
ALTER ROLE bb_app WITH LOGIN PASSWORD :'bb_app_password';

-- ── Database + schema ownership ────────────────────────────────────────────
-- The bootstrap superuser created POSTGRES_DB. Let bb_migrate own the public
-- schema so it can create objects there. bb_app gets only USAGE.
ALTER SCHEMA public OWNER TO bb_migrate;

-- CONNECT to POSTGRES_DB is covered by PUBLIC's default grant (both roles can
-- connect). The least-privilege hardening that matters is on the schema itself
-- (the real blast radius), handled by the grant/revoke below.
GRANT USAGE ON SCHEMA public TO bb_app;

-- bb_migrate may create objects in public (DDL). bb_app may NOT.
GRANT CREATE ON SCHEMA public TO bb_migrate;
REVOKE CREATE ON SCHEMA public FROM bb_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- Trusted extensions (e.g. citext, migration 001) require database-level
-- CREATE, not just schema-level — schema CREATE alone isn't enough.
DO $$
BEGIN
  EXECUTE format('GRANT CREATE ON DATABASE %I TO bb_migrate', current_database());
END
$$;

-- ── Default privileges ─────────────────────────────────────────────────────
-- Tables/sequences later created by bb_migrate are automatically usable by
-- bb_app at the DML level — so new migrations need no manual grant bookkeeping.
ALTER DEFAULT PRIVILEGES FOR ROLE bb_migrate IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bb_app;
ALTER DEFAULT PRIVILEGES FOR ROLE bb_migrate IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO bb_app;

-- bb_app explicitly gets NO DDL and NO TRUNCATE/REFERENCES default privileges.
-- (TRUNCATE is owner/DDL-class; withholding it keeps deletes auditable per-row.)
-- NOTE: the dev seed (`npm run seed`) uses TRUNCATE to reset, so it must run as
-- the bootstrap superuser or bb_migrate — NOT as bb_app. This is intentional;
-- seeding is a dev/admin action, not a runtime api action.

-- ============================================================================
-- INFRA NOTE (phase 4):
--   * This file is mounted at /docker-entrypoint-initdb.d and runs once on an
--     empty pgdata volume, as POSTGRES_USER.
--   * For PROD, pass real role passwords matching the .env connection strings,
--     e.g. via a tiny .sh wrapper in the same init dir:
--       export PGPASSWORD="$POSTGRES_PASSWORD"
--       psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
--            -v bb_migrate_password="$BB_MIGRATE_PASSWORD" \
--            -v bb_app_password="$BB_APP_PASSWORD" -f 01-roles.sql
--     If no -v is passed (dev), both roles default to password 'change-me',
--     matching the dev connection strings in .env.example.
--   * `CREATE EXTENSION IF NOT EXISTS citext` is intentionally NOT here — it is
--     migration 001, run by the migrate job as bb_migrate (single ordered place
--     for all schema-affecting DDL).
-- ============================================================================
