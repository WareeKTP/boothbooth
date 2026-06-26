# syntax=docker/dockerfile:1
# ============================================================================
# BoothBooth — client image
#
# Multi-stage: Vite build -> nginx:alpine serving the static SPA + proxying /api.
# Build context MUST be the repo root (workspace lockfile lives there).
#   compose: build: { context: ., dockerfile: app/frontend/Dockerfile }
# ============================================================================

# ── Stage 1: build (Vite -> app/frontend/dist) ──────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY app/frontend/package.json ./app/frontend/package.json
COPY app/backend/package.json ./app/backend/package.json
RUN npm ci

COPY app/frontend ./app/frontend
RUN npm run build --workspace=client

# ── Stage 2: serve (nginx) ──────────────────────────────────────────────────
FROM nginx:alpine AS serve

COPY app/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/app/frontend/dist /usr/share/nginx/html

EXPOSE 80
