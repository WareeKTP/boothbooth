# syntax=docker/dockerfile:1
# ============================================================================
# BoothBooth — client image (infra-final.md §3)
#
# Multi-stage: Vite build -> nginx:alpine serving the static SPA + proxying /api.
# Build context MUST be the repo root (workspace lockfile lives there).
#   compose: build: { context: ., dockerfile: client/Dockerfile }
#
# The final image carries NO Node/toolchain — just nginx + the built assets.
# nginx is the SOLE public origin in prod: serves the SPA with history fallback
# and reverse-proxies /api/* to the api service (same-origin => no CORS/CSRF).
# ============================================================================

# ── Stage 1: build (Vite -> client/dist) ────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
RUN npm ci

COPY client ./client
# `npm run build` = `tsc -b && vite build` -> emits client/dist (Vite default).
RUN npm run build --workspace=client

# ── Stage 2: serve (nginx) ──────────────────────────────────────────────────
FROM nginx:alpine AS serve

# Our config replaces the default server block (SPA fallback + /api proxy +
# security headers + /healthz). default.conf is the conf.d drop-in nginx loads.
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

# Built SPA into the web root referenced by nginx.conf (root /usr/share/nginx/html).
COPY --from=build /app/client/dist /usr/share/nginx/html

EXPOSE 80

# nginx:alpine's default CMD already runs nginx in the foreground.
