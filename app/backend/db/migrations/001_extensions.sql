-- 001_extensions.sql
-- Enable required extensions. citext = case-insensitive email (backend-final.md §2).
-- gen_random_uuid() is core in PG16 — no pgcrypto needed.
-- Run by the `migrate` job as the bb_migrate (DDL) role, which holds CREATE
-- EXTENSION rights; the runtime bb_app role does not.

CREATE EXTENSION IF NOT EXISTS citext;
