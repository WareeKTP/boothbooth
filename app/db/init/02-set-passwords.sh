#!/bin/bash
# ============================================================================
# BoothBooth — set real app-role passwords from env (infra-final.md §6)
#
# Runs ONCE on first cluster creation via /docker-entrypoint-initdb.d, AFTER
# 01-roles.sql has created bb_migrate / bb_app (the official postgres image runs
# init scripts in filename order, so 02- runs after 01-). The .sql file cannot
# read env vars (psql gets no -v substitution), so it seeds a dev-only
# 'change-me' fallback; this .sh script overrides those with the REAL passwords
# injected via the postgres service `environment:` block in docker-compose.yml.
#
# Why a .sh wrapper: only .sh init files get the container env (BB_MIGRATE_PASSWORD
# / BB_APP_PASSWORD). These MUST match the credentials in DATABASE_URL_MIGRATE /
# DATABASE_URL so the migrate job and api can actually authenticate.
#
# Security: passwords are interpolated by bash, never echoed; ON_ERROR_STOP=1
# aborts init (and fails the container) if either ALTER fails, so a cluster never
# comes up silently using the insecure 'change-me' default in prod.
# ============================================================================
set -euo pipefail

: "${BB_MIGRATE_PASSWORD:?BB_MIGRATE_PASSWORD must be set (see .env.example)}"
: "${BB_APP_PASSWORD:?BB_APP_PASSWORD must be set (see .env.example)}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v bb_migrate_password="$BB_MIGRATE_PASSWORD" \
  -v bb_app_password="$BB_APP_PASSWORD" <<'EOSQL'
  ALTER ROLE bb_migrate WITH LOGIN PASSWORD :'bb_migrate_password';
  ALTER ROLE bb_app     WITH LOGIN PASSWORD :'bb_app_password';
EOSQL
