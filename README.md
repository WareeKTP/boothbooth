# 🏪 BoothBooth

เป็นระบบจัดการสต็อกสินค้าและระบบขายหน้าร้าน (POS) สำหรับธุรกิจที่มีการเปิดบูธในงานเอ็กซ์โป, ตลาดนัด หรืองานกิจกรรมต่าง ๆ โดยที่สินค้าส่วนใหญ่ถูกเก็บไว้ในคลังกลาง แล้วกระจายไปยังแต่ละบูธ/ร้านค้า 
มีผู้ใช้สองประเภทคือ เจ้าของ (Owner) ที่สามารถติดตามยอดขายและสต็อกของทุกบูธแบบเรียลไทม์ และ พนักงาน (Staff) ที่ทำหน้าที่ขายสินค้าและขอเติมสต็อกให้บูธหรือหน้าร้านของตน

---

## ใครใช้งานบ้าง

**เจ้าของ (Owner)** — เห็นภาพรวมทั้งหมด: ยอดขายรวม, สต็อกสินค้าในทุกบูธ, สินค้าไหนขายดีที่สุด และอนุมัติคำขอเติมสินค้าทั้งหมด

**พนักงาน (Staff)** — ดูแลบูธของตัวเอง บันทึกการขาย ตรวจสอบสต็อกของตัวเอง และส่งคำขอเติมสินค้าจากคลังเมื่อของใกล้หมด

---

## ทำอะไรได้บ้าง

- บันทึกการขายที่หน้าร้าน (ระบบ POS)
- ติดตามสต็อกสินค้าในทุกหน้าร้านและคลังสินค้ากลาง
- พนักงานขอเติมสินค้า หลังจากเจ้าของอนุมัติ ระบบจะเข้าสู่กระบวนการส่งสินค้า
- แดชบอร์ดเจ้าของแสดงยอดขายและข้อมูลสินค้าแบบเรียลไทม์
- หน้าร้านแต่ละที่ล็อกอินด้วยบัญชีของตัวเอง — พนักงานเห็นแค่บูธของตัวเอง

---

## ⚡ Tech Stack

| Layer | Technology |
|---|---|
| 🖥️ Frontend | React |
| 🔧 Backend | Fastify |
| 🗄️ Database | PostgreSQL |
| 🔐 Auth | Cookie-based sessions, Argon2id password hashing |
| 🌐 Proxy | nginx |
| 📦 Runtime | Node 20 Alpine, Docker + Docker Compose |

---

## 🖼️ Preview

| | |
|---|---|
| ![Log-in page](preview/Log-in%20page.png) | ![POS page](preview/POS%20page.png) |
| ![Booth Inventory](preview/Booth%20Inventory.png) | ![Warehouse Stock](preview/Warehouse%20Stock.png) |

![Daily sales](preview/Daily%20sales.png)

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
