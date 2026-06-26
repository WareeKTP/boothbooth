# 🏪 BoothBooth

> Inventory management and point-of-sale system for vendors running multiple booths at a live expo or market.

Stock lives in one central warehouse and gets allocated out to each booth. The **owner** monitors revenue and stock across every booth in real time; **staff** ring up sales and request restocks from their assigned booth.

---

## ⚡ Tech Stack

| Layer | Technology |
|---|---|
| 🖥️ Frontend | React 18, TypeScript, Vite, React Router v6, TanStack Query |
| 🔧 Backend | Fastify (Node.js + TypeScript), raw `pg` driver (no ORM) |
| 🗄️ Database | PostgreSQL 16 with `citext` extension |
| 🔐 Auth | Cookie-based sessions (httpOnly, signed), Argon2id password hashing |
| 🌐 Proxy | nginx — serves the SPA and reverse-proxies `/api/*` |
| 📦 Runtime | Node 20 Alpine, Docker + Docker Compose |

---

## 🖼️ Preview

> Screenshots coming soon.

---

## 🏗️ System Design

```
Browser
  │
  ▼
┌─────────────────────────────────────┐
│  client  (nginx : 8080)             │
│  Serves built React SPA             │
│  Proxies  /api/*  →  api:4000       │
└──────────────────┬──────────────────┘
                   │ internal network only
                   ▼
┌─────────────────────────────────────┐
│  api  (Fastify : 4000)              │
│  Business logic, session auth       │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  postgres  (PostgreSQL 16)          │
│  Named volume — data persists       │
└─────────────────────────────────────┘
          ▲
          │ (runs once at first boot, then exits)
┌─────────────────────────────────────┐
│  migrate  (one-shot job)            │
│  Applies SQL migrations, then exits │
└─────────────────────────────────────┘
```

**Key design decisions:**

- 🛡️ `client` is the only service exposed to the outside — same-origin proxying removes any CORS/CSRF surface.
- 🔒 `migrate` gates `api` startup via Docker health checks. The API will not start until migrations exit with code 0.
- 👥 Two least-privilege database roles: `bb_migrate` (DDL only) and `bb_app` (DML only). A compromised API process cannot drop tables.
- 📒 Sales are an immutable append-only ledger. Remaining stock is always derived from allocations minus sales — never a mutable counter that can drift.

---

## 🐳 Services

| Service | Image | Port | Role |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | — | 🗄️ Primary datastore |
| `migrate` | `boothbooth-api` | — | ⚙️ One-shot DDL job; exits after applying migrations |
| `api` | `boothbooth-api` | `4000` *(dev only)* | 🔧 Fastify REST API |
| `client` | `boothbooth-client` | `8080` | 🌐 nginx SPA + API proxy |

---

## 🛣️ API Routes and Features

All routes are prefixed `/api`. Auth uses an httpOnly session cookie set on login.

### 🔑 Auth

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public | Authenticate and receive session cookie |
| `POST` | `/api/auth/logout` | Any | Destroy session and clear cookie |
| `GET` | `/api/auth/me` | Any | Fetch current account (SPA bootstrap) |

### 👤 Staff Accounts

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/api/accounts` | Owner | Register a new staff account, assigned to a booth |

### 📊 Dashboard

| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/api/dashboard` | Owner | KPIs, booth revenue series, top products, recent sales |

### 🏪 Booths

| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/api/booths` | Owner | List all booths with summary stats |
| `GET` | `/api/booths/:boothId` | Owner / Staff (own) | Booth detail — inventory, transactions, breakdown |

### 🏭 Warehouse

| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/api/warehouse` | Owner + Staff | Full warehouse stock list with status |
| `POST` | `/api/warehouse/receive` | Owner | Receive new stock into the warehouse (idempotent) |

### 🛒 POS / Sales

| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/api/pos/catalog` | Staff | Products available to sell at own booth |
| `POST` | `/api/sales` | Staff | Complete a sale (idempotent via `Idempotency-Key` header) |

### 📦 Restock

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/api/restock-requests` | Staff | Request stock from the warehouse |
| `GET` | `/api/restock-requests` | Owner (all) / Staff (own) | List restock requests |
| `POST` | `/api/restock-requests/:id/fulfill` | Owner | Fulfill a request — transfers stock warehouse → booth |

### ⚙️ Account Settings

| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/api/me/booth` | Staff | Own booth detail |
| `GET` | `/api/me/daily-log` | Staff | Today's sales summary and transactions |
| `PATCH` | `/api/me/profile` | Any | Update name, email, or phone |
| `PATCH` | `/api/me/password` | Any | Change password (invalidates other sessions) |
| `PATCH` | `/api/me/prefs` | Any | Toggle notification preferences |

### 🩺 Health

| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/healthz` | Public | Returns `ok` when DB is reachable |

---

## 📁 Directory Topology

```
boothbooth/
├── app/
│   ├── frontend/               # 🖥️ React SPA
│   │   ├── src/
│   │   │   ├── app/            # Shell, router, theme, toast, session
│   │   │   ├── features/       # One folder per page/domain
│   │   │   │   ├── auth/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── booths/
│   │   │   │   ├── warehouse/
│   │   │   │   ├── pos/
│   │   │   │   ├── mybooth/
│   │   │   │   ├── restock/
│   │   │   │   ├── dailylog/
│   │   │   │   ├── settings/
│   │   │   │   └── staff/
│   │   │   ├── components/     # Shared UI components
│   │   │   ├── lib/            # API client, query hooks, types
│   │   │   └── styles/         # Global CSS
│   │   ├── Dockerfile
│   │   └── nginx.conf
│   │
│   ├── backend/                # 🔧 Fastify API
│   │   ├── src/
│   │   │   ├── routes/         # Route handlers (one file per domain)
│   │   │   ├── domain/         # Business logic queries
│   │   │   ├── db/             # Pool, migrate, seed scripts
│   │   │   ├── lib/            # Auth, errors, currency, idempotency
│   │   │   └── plugins/        # Fastify auth plugin
│   │   └── Dockerfile
│   │
│   └── db/
│       └── init/               # 🗄️ Postgres init scripts (roles + passwords)
│
├── docker-compose.yml          # Base service definitions
├── docker-compose.override.yml # Dev extras (live reload, exposed ports)
├── docker-compose.prod.yml     # Production hardening
├── .env.example                # Required environment variable reference
└── package.json                # npm workspaces root
```

---

## 🚀 Getting Started

### Prerequisites

- 🐳 [Docker Desktop](https://www.docker.com/products/docker-desktop/) with Docker Compose v2

### 1️⃣ Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set real values. Required fields:

| Variable | Description |
|---|---|
| `POSTGRES_PASSWORD` | 🔑 Postgres superuser password |
| `BB_MIGRATE_PASSWORD` | 🔑 Password for the `bb_migrate` DDL role |
| `BB_APP_PASSWORD` | 🔑 Password for the `bb_app` DML role |
| `DATABASE_URL_MIGRATE` | 🔗 Full connection string using `bb_migrate` credentials |
| `DATABASE_URL` | 🔗 Full connection string using `bb_app` credentials |
| `SESSION_COOKIE_SECRET` | 🛡️ Random string, **minimum 32 characters** |

### 2️⃣ Start the stack

**🔄 Dev mode** — live API reload, database and API ports exposed locally:

```bash
docker compose up
```

→ API available at `http://localhost:4000`
→ For the frontend with hot reload, run separately:
```bash
cd app/frontend && npm run dev
```
→ 🌐 open `http://localhost:5173`

**📦 Full containerized** — includes the nginx-served frontend:

```bash
docker compose --profile client up
```

→ 🌐 open `http://localhost:8080`

**🏭 Production** — no exposed ports, no dev mounts:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### 3️⃣ Seed demo data

The seed script uses `TRUNCATE` so it needs the migrate role's connection string:

```bash
docker compose exec \
  -e DATABASE_URL="$(grep DATABASE_URL_MIGRATE .env | cut -d= -f2-)" \
  api npm run seed --workspace=@boothbooth/server
```

Demo logins (password: `password123`):

| Email | Role |
|---|---|
| `owner@boothbooth.dev` | 👑 Owner |
| `ngozi@boothbooth.dev` | 🧑‍💼 Staff |
| `tunde@boothbooth.dev` | 🧑‍💼 Staff |
| `amara@boothbooth.dev` | 🧑‍💼 Staff |

### 4️⃣ Stop

```bash
docker compose down          # stop, keep data
docker compose down -v       # 🗑️ stop and wipe the database
```
