# syntax=docker/dockerfile:1
# Phase 999.18.2 Wave 2 — applied form of Phase 999.18.1 ADR-001 §Decision (a) drop pnpm-deploy
# + (b) M3 architectural-eliminate (injectWorkspacePackages OFF) + (c) distroless runner
# + transport-aligned healthcheck protocol (c.1)+(c.2)+(c.3).
# All 27 invariants I-S0.1..I-S2.9 grep-verifiable per 999.18.1-DOCKERFILE-REFERENCE
# Per-Step Invariant Cross-Ref Matrix.

# ─── Stage 0: Build args ──────────────────────────────────────
# I-S0.2: APP_NAME has NO default (fail-loud — build MUST fail если caller forgets --build-arg APP_NAME=<svc>)
ARG APP_NAME
# I-S0.3: NODE_VERSION default = 22-alpine для builder stages
ARG NODE_VERSION=22-alpine
# I-S2.1.6: pinned grpc_health_probe version для security re-pinning per advisory
ARG GRPC_HEALTH_PROBE_VERSION=v0.4.24
# I-S0.4 + I-S0.5: NO `ENV PROTO_DIR=...` directive — F-05 closure (single source of truth in .env.docker via env_file)

# ─── Stage 1.1: Pruner ────────────────────────────────────────
# I-S1.1: COPY . . accepted as cache-invalidating by design — pruner stage requires full workspace
# для compute the dependency graph slice; pruner output (out/json/ + out/full/) feeds downstream stages.
FROM node:${NODE_VERSION} AS pruner
WORKDIR /app
# I-S1.2: corepack enable MUST precede pnpm dlx invocations (pnpm 11 ships via corepack)
RUN corepack enable
COPY . .
# Re-declare APP_NAME for pruner stage scope per Docker multi-stage ARG rules
ARG APP_NAME
# I-S1.7 (pruner half): turborepo prune carves the dep-closure slice
RUN pnpm dlx turbo prune --docker @email-platform/${APP_NAME}

# ─── Stage 1.1.5: REMOVED per 999.18.3 Plan 03 (D-08) ──────────────
# Pre-amendment fetcher orphan-stage retired — BuildKit DAG-pruning
# skipped it (no COPY --from=fetcher anywhere). See ADR-001
# §"Implementation Path & Amendments" Iteration 5 + 999.18.3-SYSTEM-RESEARCH.md §6.

# ─── Stage 1.2: Installer (offline install) ───────────────────
# I-S1.3: COPY ONLY package.json + lockfile from /app/out/json/ — NEVER source code (pruner-anchor cache discipline).
# I-S1.4 + I-S1.5: --offline + --frozen-lockfile required because injectWorkspacePackages: false
# (M3 architectural-eliminate landed в Wave 1 b8d4fa0); install layer survives source-code commits (manifests-only key).
FROM node:${NODE_VERSION} AS installer
WORKDIR /app
# I-S1.Z (NEW per 999.18.3 D-08): canonical pnpm.io ENV PNPM_HOME = /pnpm
# → устраняет pnpm-11 default store-dir mismatch (/root/.local/share/pnpm/store/v11
#   ignores cache-mount target=/pnpm/store без явной конфигурации).
# Reference: pnpm.io/docker (Example 1) + depot.dev/...optimal-dockerfiles/node-pnpm-dockerfile.
# Empirical validation: probe m3-pnpmhome 10s cold / 0s warm-cached PASS
# (999.18.3-SYSTEM-RESEARCH.md §3 + /tmp/probes/m3-pnpmhome/).
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY --from=pruner /app/out/json/ ./
# I-S1.AA (NEW per 999.18.3 D-08): single pnpm install per pnpm.io canonical pattern.
# Drop --offline (no fetch/offline split — over-engineering per 999.18.3-SYSTEM-RESEARCH.md §1 +
# §6: Vercel Turborepo canonical + fintlabs cookbook + pnpm.io official все используют single install).
# Cache-mount target=/pnpm/store aligned to ENV PNPM_HOME=/pnpm; cache-id renamed
# pnpm-install → pnpm-store для consistency с pnpm.io Example 1 naming.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Download grpc_health_probe binary per-arch (I-S2.1.5 + I-S2.1.6)
# apk --print-arch returns x86_64/aarch64 (Alpine convention); transformer maps к amd64/arm64
# (GitHub release naming). BuildKit handles per-platform leg automatically когда
# `docker buildx build --platform linux/amd64,linux/arm64` invoked в Wave 3.
ARG GRPC_HEALTH_PROBE_VERSION
RUN apk add --no-cache wget \
    && wget -qO/usr/local/bin/grpc_health_probe \
        "https://github.com/grpc-ecosystem/grpc-health-probe/releases/download/${GRPC_HEALTH_PROBE_VERSION}/grpc_health_probe-linux-$(apk --print-arch | sed 's/x86_64/amd64/;s/aarch64/arm64/')" \
    && chmod +x /usr/local/bin/grpc_health_probe

# ─── Stage 1.3: Builder ───────────────────────────────────────
# I-S1.6: COPY --from=pruner /app/out/full/ (pruner output) — NOT `COPY . .` — pruner already filtered к dep-closure.
# I-S1.7: pnpm exec turbo run build (NOT pnpm --filter ... run build — bypasses turbo cache, F-03 root cause).
# I-S1.8: NO node-modules-purge cycle (F-02 closure under M3 architectural-eliminate).
# I-S1.9: NO `pnpm generate:contracts` invocation (F-12 closure — Decision (d) Placement A pre-build CI).
FROM installer AS builder
WORKDIR /app
# PNPM_HOME inherited from installer FROM; explicit re-declaration для grep-discoverability
# + защита от accidental Stage 1.3 base swap в future amendments.
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# I-S1.BB (NEW per 999.18.3 D-10): следующий ENV directive устраняет pnpm 11
# ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY в `pnpm prune --prod` step
# (non-TTY Docker BuildKit context). Source-code canonical:
# pnpm/installing/deps-installer/src/install/validateModules.ts:149-154
# throws когда `!process.stdin.isTTY && opts.confirmModulesPurge`;
# install/index.ts:317 wires `confirmModulesPurge: opts.confirmModulesPurge && !opts.ci`
# — opts.ci=true → confirmModulesPurge short-circuits к false → throw skipped.
# Reference: pnpm error-hint in-product documentation; Issue #9966 maintainer endorse
# (Zoltan Kochan + tjenkinson). 999.18.3-PRUNE-VERIFY.md §2 verbatim source verification.
ENV CI=true
COPY --from=pruner /app/out/full/ ./
ARG APP_NAME
RUN pnpm exec turbo run build --filter=@email-platform/${APP_NAME}

# Build metadata (preserved from pre-W2 Dockerfile lines 74-76)
ARG BUILD_COMMIT=local
ARG BUILD_BRANCH=local
RUN echo "{\"commit\":\"${BUILD_COMMIT}\",\"branch\":\"${BUILD_BRANCH}\",\"built\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > /app/build-info.json

# I-S1.Y (PRESERVED per D-01 invariant; cache-id renamed pnpm-install → pnpm-store
# per 999.18.3 D-08 alignment с installer stage cache-mount).
# Substance preserved verbatim: post-`nest build` MANDATORY devDeps strip
# in-place; runs AFTER `nest build` AND AFTER `build-info.json` materialised.
# Workspace symlinks preserved (link:../../packages/*; only registered
# devDeps removed per pnpm CLI docs https://pnpm.io/11.x/cli/prune).
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm prune --prod

# ─── Stage 2: Runner (distroless, non-root) ───────────────────
# I-S2.1 + I-S2.2: distroless base image pre-bakes uid 65532 (no /etc/passwd → numeric USER form mandatory).
# I-S2.4 + I-S2.5: manual COPY closure (no install-step variability, no deploy bundle) → byte-deterministic given same builder output (F-20).
# I-S2.9: exec-form CMD (JSON array) — node = PID 1, receives SIGTERM directly для NestJS OnApplicationShutdown lifecycle.
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runner
WORKDIR /app

# I-S2.1.5: grpc_health_probe binary в /usr/local/bin/ для (c.2)+(c.3) services compose healthcheck
# `["CMD", "grpc_health_probe", "-addr=:<grpc-port>"]` invocation (Wave 3 task #3 owns compose healthcheck swap).
COPY --from=installer /usr/local/bin/grpc_health_probe /usr/local/bin/grpc_health_probe

# I-S2.3: Manual COPY closure replaces deploy bundle (per ADR (a)). Order matters —
# packages/ COPY MUST land BEFORE node_modules symlinks resolve at runtime (Docker COPY preserves
# symlinks as symlinks under M3 architectural-eliminate — `link:../../packages/*` references).
ARG APP_NAME
COPY --from=builder /app/apps/${APP_NAME}/dist ./dist
COPY --from=builder /app/apps/${APP_NAME}/node_modules ./node_modules
COPY --from=builder /app/packages /app/packages
COPY --from=builder /app/node_modules/.modules.yaml /app/node_modules/.modules.yaml
COPY --from=builder /app/build-info.json /app/build-info.json

# I-S0.4: NO `ENV PROTO_DIR=...` line (F-05 closure — value lives only в .env.docker).
# V8/Express runtime optimization preserved.
ENV NODE_ENV=production

# I-S2.8: USER MUST be LAST non-CMD directive.
# I-S2.2: numeric form mandatory (distroless без /etc/passwd для name resolution).
USER 65532:65532

# I-S2.9: exec-form CMD (JSON array) — node = PID 1, receives SIGTERM directly.
CMD ["node", "dist/main.js"]
