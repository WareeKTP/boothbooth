-- 002_schema.sql
-- Full BoothBooth schema (backend-final.md §2). Authoritative DDL.
-- Conventions: snake_case; UUID PKs via gen_random_uuid(); money in integer
-- minor units (*_minor); created_at timestamptz default now(). Sales are an
-- immutable ledger; sold/remaining are always derived.

-- ── Top-level tenant container ─────────────────────────────────────────────
CREATE TABLE expos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  currency    TEXT NOT NULL,        -- ISO 4217, e.g. 'NGN'. Validated app-side.
  starts_on   DATE NOT NULL,
  ends_on     DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (char_length(currency) = 3),
  CHECK (ends_on >= starts_on)
);

CREATE TABLE booths (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expo_id     UUID NOT NULL REFERENCES expos(id),
  code        TEXT NOT NULL,        -- 'A1', 'B3'
  name        TEXT NOT NULL,        -- 'Booth A1'
  location    TEXT NOT NULL,        -- 'Hall A · Aisle 2'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (expo_id, code)
);

-- Accounts: one owner + N staff. Staff bound to exactly one booth; owner none.
CREATE TABLE accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expo_id               UUID NOT NULL REFERENCES expos(id),
  role                  TEXT NOT NULL CHECK (role IN ('owner','staff')),
  full_name             TEXT NOT NULL,
  email                 CITEXT NOT NULL,
  phone                 TEXT,
  password_hash         TEXT NOT NULL,              -- argon2id
  booth_id              UUID REFERENCES booths(id),
  notify_low_stock      BOOLEAN NOT NULL DEFAULT true,
  notify_daily_summary  BOOLEAN NOT NULL DEFAULT true,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (expo_id, email),
  CHECK ( (role = 'staff' AND booth_id IS NOT NULL)
       OR (role = 'owner' AND booth_id IS NULL) )
);

CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expo_id         UUID NOT NULL REFERENCES expos(id),
  name            TEXT NOT NULL,
  sku             TEXT NOT NULL,
  category        TEXT NOT NULL,
  price_minor     INTEGER NOT NULL CHECK (price_minor >= 0),
  warehouse_qty   INTEGER NOT NULL DEFAULT 0 CHECK (warehouse_qty >= 0),
  reorder_point   INTEGER NOT NULL DEFAULT 0 CHECK (reorder_point >= 0),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (expo_id, sku)
);

-- Per-booth allocation. allocated_qty = cumulative units moved warehouse->booth.
CREATE TABLE allocations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booth_id       UUID NOT NULL REFERENCES booths(id),
  product_id     UUID NOT NULL REFERENCES products(id),
  allocated_qty  INTEGER NOT NULL DEFAULT 0 CHECK (allocated_qty >= 0),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (booth_id, product_id)
);

-- Per-expo sequential receipt numbers ('S-1042'). One counter row per expo.
CREATE TABLE sale_sequences (
  expo_id   UUID PRIMARY KEY REFERENCES expos(id),
  next_seq  BIGINT NOT NULL DEFAULT 1042
);

-- Sales = immutable ledger. Source of truth for sold/remaining/revenue.
CREATE TABLE sales (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expo_id       UUID NOT NULL REFERENCES expos(id),
  display_id    TEXT NOT NULL,        -- 'S-1042'
  booth_id      UUID NOT NULL REFERENCES booths(id),
  account_id    UUID NOT NULL REFERENCES accounts(id),
  total_minor   INTEGER NOT NULL CHECK (total_minor >= 0),
  sold_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (expo_id, display_id)
);

CREATE TABLE sale_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id          UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id       UUID NOT NULL REFERENCES products(id),
  qty              INTEGER NOT NULL CHECK (qty > 0),
  unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor >= 0),
  UNIQUE (sale_id, product_id)
);

CREATE TABLE restock_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booth_id        UUID NOT NULL REFERENCES booths(id),
  product_id      UUID NOT NULL REFERENCES products(id),
  requested_by    UUID NOT NULL REFERENCES accounts(id),
  requested_qty   INTEGER NOT NULL CHECK (requested_qty > 0),
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','fulfilled','rejected')),
  resolved_by     UUID REFERENCES accounts(id),
  resolved_qty    INTEGER CHECK (resolved_qty >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ
);

-- Server-side sessions (cookie auth). Server-side so owner can revoke instantly.
CREATE TABLE sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,    -- sha256 of the opaque cookie token
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotency dedupe for money-moving POSTs.
CREATE TABLE idempotency_keys (
  key               UUID NOT NULL,
  endpoint          TEXT NOT NULL,         -- e.g. 'POST /api/sales'
  account_id        UUID NOT NULL REFERENCES accounts(id),
  response_status   INTEGER NOT NULL,
  response_snapshot JSONB NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (key, endpoint)
);

-- ── Indexes for hot read paths ─────────────────────────────────────────────
CREATE INDEX idx_sales_booth_time   ON sales (booth_id, sold_at);
CREATE INDEX idx_sales_expo_time    ON sales (expo_id, sold_at);
CREATE INDEX idx_sale_items_sale    ON sale_items (sale_id);
CREATE INDEX idx_sale_items_product ON sale_items (product_id);
CREATE INDEX idx_alloc_booth        ON allocations (booth_id);
CREATE INDEX idx_products_expo      ON products (expo_id) WHERE is_active;
CREATE INDEX idx_sessions_token     ON sessions (token_hash);
CREATE INDEX idx_restock_status     ON restock_requests (status, created_at);
