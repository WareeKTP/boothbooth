# syntax=docker/dockerfile:1
# ============================================================================
# BoothBooth — api + migrate image
#
# Multi-stage, npm-workspaces aware. Build context MUST be the repo root so the
# root package.json + package-lock.json (the workspace lockfile) are available.
#   build:  docker build -f app/backend/Dockerfile -t boothbooth-api .
# (docker-compose does this via `build: { context: ., dockerfile: app/backend/Dockerfile }`.)
#
# One image, two services:
#   - api      : default CMD -> `npm start`  -> node dist/index.js
#   - migrate  : overrides command          -> npm run migrate -> node dist/db/migrate.js
#
# CRITICAL: the migrate runner reads .sql files from disk at runtime, resolving
# <pkg>/db/migrations relative to dist/db (../../db/migrations).
# So the runtime image must carry db/ AS A SIBLING of dist/.
# ============================================================================

# ── Stage 1: build (TypeScript -> dist/) ────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# Copy only manifests first so this layer caches unless dependencies change.
COPY package.json package-lock.json ./
COPY app/backend/package.json ./app/backend/package.json
RUN npm ci

COPY app/backend ./app/backend
RUN npm run build --workspace=@boothbooth/server

# ── Stage 2: runtime (prod deps + compiled output, non-root) ────────────────
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app/app/backend

COPY package.json package-lock.json /app/
COPY app/backend/package.json ./package.json
RUN cd /app \
 && npm ci --omit=dev --workspace=@boothbooth/server \
 && npm cache clean --force

# Compiled JS.
COPY --from=build /app/app/backend/dist ./dist
# db/ must sit beside dist/ for the migrate runner (../../db/migrations from dist/db).
COPY app/backend/db ./db

RUN addgroup -S boothbooth && adduser -S boothbooth -G boothbooth \
 && chown -R boothbooth:boothbooth /app
USER boothbooth

EXPOSE 4000

CMD ["npm", "start"]
