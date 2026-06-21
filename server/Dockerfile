# syntax=docker/dockerfile:1
# ============================================================================
# BoothBooth — api + migrate image (infra-final.md §3)
#
# Multi-stage, npm-workspaces aware. Build context MUST be the repo root so the
# root package.json + package-lock.json (the workspace lockfile) are available.
#   build:  docker build -f server/Dockerfile -t boothbooth-api .
# (docker-compose does this for us via `build: { context: ., dockerfile: server/Dockerfile }`.)
#
# One image, two services:
#   - api      : default CMD -> `npm start`  -> node dist/index.js
#   - migrate  : overrides command          -> npm run migrate -> node dist/db/migrate.js
#
# CRITICAL (backend note): the migrate runner reads .sql files from disk at
# runtime, resolving <pkg>/db/migrations relative to dist/db (../../db/migrations).
# So the runtime image must carry server/db/ AS A SIBLING of dist/. See the
# COPY of ./server/db below.
# ============================================================================

# ── Stage 1: build (TypeScript -> dist/) ────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# Install deps using the workspace lockfile. Copy only manifests first so this
# layer caches unless dependencies actually change.
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
# Install the full dependency tree for all workspaces (we only build server, but
# npm ci against the root lockfile is the reliable workspace install path).
RUN npm ci

# Compile the server workspace.
COPY server ./server
RUN npm run build --workspace=@boothbooth/server

# ── Stage 2: runtime (prod deps + compiled output, non-root) ────────────────
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app/server

# Prod-only dependencies, resolved from the same lockfile. We scope the install
# to the server workspace and omit dev deps (no TypeScript toolchain in runtime).
COPY package.json package-lock.json /app/
COPY server/package.json ./package.json
RUN cd /app \
 && npm ci --omit=dev --workspace=@boothbooth/server \
 && npm cache clean --force

# Compiled JS.
COPY --from=build /app/server/dist ./dist
# db/ MUST sit beside dist/ — the migrate runner reads ./db/migrations from disk
# (resolved as dist/db/../../db/migrations). init/ is mounted into postgres via
# compose, not needed here, but copying the whole db/ keeps it simple and correct.
COPY server/db ./db

# node_modules for the server workspace lives at the repo-root level in a
# workspace install; make sure the runtime can resolve it from /app/server.
# (npm ci --workspace hoists to /app/node_modules; WORKDIR /app/server resolves
#  up the tree to it, so no extra copy is needed.)

# Run as a non-root user (security: drop privileges in the container).
RUN addgroup -S boothbooth && adduser -S boothbooth -G boothbooth \
 && chown -R boothbooth:boothbooth /app
USER boothbooth

EXPOSE 4000

# Default command = api service. The `migrate` compose service overrides this.
CMD ["npm", "start"]
