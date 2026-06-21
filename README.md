# BoothBooth

Inventory + POS system for vendors running multiple booths at a live expo/market/exhibition.

## What it does

Stock lives in one central warehouse and gets allocated out to each booth. Staff at a booth
ring up sales on a POS screen; the owner watches revenue and stock across every booth from
a dashboard, restocks booths from the warehouse, and reviews each booth's numbers.

- **Owner** — sees revenue/stock across all booths, drills into one booth, manages the
  warehouse, fulfills staff restock requests.
- **Staff** — bound to one booth. Rings up sales fast (POS), checks their own stock,
  requests restock, reviews their own daily log.

Sold/remaining stock is always calculated from the sales ledger itself — never a counter
that can drift out of sync — so the numbers the owner sees are always trustworthy.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React + TypeScript, Vite, React Router, TanStack Query |
| Backend | Fastify (Node.js + TypeScript), raw `pg` (no ORM) |
| Database | PostgreSQL 16 |
| Auth | Cookie-based sessions, Argon2 password hashing |
| Deployment | Docker + Docker Compose, nginx (serves the frontend + proxies the API) |

## System design

Four containers on one private network:

```
 browser
    |
    v
[ client ] nginx — serves the built React app, proxies /api/* to the API
    |
    v
[ api ] Fastify — business logic, owns no schema directly
    |
    v
[ postgres ] — the actual data
    ^
    |
[ migrate ] — one-time job, runs DB migrations then exits, gates api startup
```

- `client` is the **only** thing exposed to the outside world. The browser never talks to
  the API directly — same-origin proxying means no CORS/CSRF headaches.
- `migrate` runs once per deploy (creates/updates tables), then exits. `api` won't start
  until `migrate` finishes successfully.
- The database uses two separate roles for least privilege: one that can only change the
  schema (used briefly by `migrate`), and one that can only read/write rows (used by `api`
  at all times). If the API is ever compromised, it still can't drop a table.

## Project layout

```
client/          React frontend source
server/          Fastify API source + DB migrations
docker-compose.yml             base service definitions (always used)
docker-compose.override.yml    dev-only extras (auto-used by `docker compose up`)
docker-compose.prod.yml        production hardening (used only when explicitly requested)
.env.example                   reference for which environment variables exist (not committed)
```

## How to deploy

Both modes need a `.env` file first — fill in real values
(passwords, a long random `SESSION_COOKIE_SECRET`, etc).

### Dev mode (local coding, live reload)

```
docker compose up
```

This automatically also loads `docker-compose.override.yml`, which gives you:
- Live code reload for the API (edit and save, no rebuild needed)
- Direct access to the database (`localhost:5432`) and API (`localhost:4000`) for debugging
- The frontend itself is usually run separately for the fastest reload loop:
  ```
  cd client && npm run dev
  ```
  → open `http://localhost:5173`

If you want the full containerized app (including the nginx-served frontend) instead:
```
docker compose --profile client up
```
→ open `http://localhost:8080`

### Prod mode (real deployment)

```
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

This skips the dev override entirely: no exposed database/API ports, no live-reload
mounts, production environment settings. Only the app itself is reachable, at
`http://localhost:8080` (or whatever domain/TLS you put in front of it).

To stop either mode:
```
docker compose down
```
(add `-v` only if you also want to wipe the database)
