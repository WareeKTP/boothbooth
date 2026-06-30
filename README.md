# 🏪 BoothBooth

A simple tool for vendors running multiple booths at an expo or market. Stock lives in one central warehouse and gets shared out to each booth. Everyone sees what's selling and what needs restocking — in real time.

---

## ใครใช้งานบ้าง

**เจ้าของ (Owner)** — เห็นภาพรวมทั้งหมด: ยอดขายรวม, สต็อกสินค้าในทุกบูธ, สินค้าไหนขายดีที่สุด และอนุมัติคำขอเติมสินค้าทั้งหมด

**พนักงาน (Staff)** — ดูแลบูธของตัวเอง บันทึกการขาย ตรวจสอบสต็อกของตัวเอง และส่งคำขอเติมสินค้าจากคลังเมื่อของใกล้หมด

---

## ทำอะไรได้บ้าง

- บันทึกการขายที่บูธ (ระบบ POS)
- ติดตามสต็อกสินค้าในทุกบูธและคลังสินค้ากลาง
- พนักงานขอเติมสินค้าได้ เจ้าของอนุมัติแล้วระบบโอนสินค้าให้อัตโนมัติ
- แดชบอร์ดเจ้าของแสดงยอดขายและข้อมูลสินค้าแบบเรียลไทม์
- แต่ละคนล็อกอินด้วยบัญชีของตัวเอง — พนักงานเห็นแค่บูธของตัวเอง

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

## 🚀 Getting Started

You need [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed. That's the only requirement.

### 1️⃣ Configure environment

```bash
cp .env.example .env
```

Open `.env` in any text editor and fill in the passwords. The file has comments explaining each one.

| Variable | Description |
|---|---|
| `POSTGRES_PASSWORD` | 🔑 Postgres superuser password |
| `BB_MIGRATE_PASSWORD` | 🔑 Password for the `bb_migrate` DDL role |
| `BB_APP_PASSWORD` | 🔑 Password for the `bb_app` DML role |
| `DATABASE_URL_MIGRATE` | 🔗 Full connection string using `bb_migrate` credentials |
| `DATABASE_URL` | 🔗 Full connection string using `bb_app` credentials |
| `SESSION_COOKIE_SECRET` | 🛡️ Random string, **minimum 32 characters** |

### 2️⃣ Start the app

```bash
docker compose up
```

Then open **http://localhost:8080** in your browser.

### 3️⃣ Load demo data (optional)

To try the app with sample products and sales already loaded:

```bash
docker compose exec \
  -e DATABASE_URL="$(grep DATABASE_URL_MIGRATE .env | cut -d= -f2-)" \
  api npm run seed --workspace=@boothbooth/server
```

Demo accounts (password for all: `password123`):

| Email | Role |
|---|---|
| `owner@boothbooth.dev` | 👑 Owner |
| `ngozi@boothbooth.dev` | 🧑‍💼 Staff |
| `tunde@boothbooth.dev` | 🧑‍💼 Staff |
| `amara@boothbooth.dev` | 🧑‍💼 Staff |

### 4️⃣ Stop

```bash
docker compose down        # stop, keep your data
docker compose down -v     # 🗑️ stop and delete all data
```
