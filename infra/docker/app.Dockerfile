# syntax=docker/dockerfile:1
# Phase 999.18.3 — 5-layer build architecture closure (FR-01..FR-11).
# Two-install Vercel canonical pattern: prod-deps stage isolated from build stage.
# All Stage 0 + Stage 2 invariants from 999.18.1-DOCKERFILE-REFERENCE preserved;
# Stage 1.2/1.3 substrate superseded by FR-04 two-install (Plan 09 amends reference).

# ─── Stage 0: Build args ──────────────────────────────────────
# I-S0.2: APP_NAME has NO default (fail-loud).
# I-S0.3: NODE_VERSION default = 22-alpine для builder stages.
# I-S2.1.6: pinned grpc_health_probe version per security advisory.
# I-S0.4 + I-S0.5: NO `ENV PROTO_DIR=...` — single source of truth in .env.docker.
ARG APP_NAME
ARG NODE_VERSION=22-alpine
ARG GRPC_HEALTH_PROBE_VERSION=v0.4.24

# ─── Stage 1.1: Pruner ────────────────────────────────────────
# I-S1.1: pruner stage requires full workspace для compute the dep-closure slice.
FROM node:${NODE_VERSION} AS pruner
WORKDIR /app
# I-S1.2: corepack enable MUST precede pnpm dlx invocations.
RUN corepack enable
COPY . .
ARG APP_NAME
# I-S1.7 pruner half: turborepo prune carves the dep-closure slice
RUN pnpm dlx turbo prune --docker @email-platform/${APP_NAME}

# ─── Stage 1.2: prod-deps (FR-04 — production deps ONLY) ──────
# This stage's node_modules has NO devDeps → husky never installed → no leak.
FROM node:${NODE_VERSION} AS prod-deps
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY --from=pruner /app/out/json/ ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile

# ─── Stage 1.3: Builder (FR-04 — full install + turbo build) ──
# Full install (devDeps включены) → turbo run build delegates к L2 orchestrator.
# NO `pnpm prune --prod` post-build (D-01 Variant 2 kostyl, superseded by FR-04).
# NO `ENV CI=true` (D-10 kostyl, superseded — no prune step → no validateModules trigger).
# NO `ENV HUSKY=0` — there is no husky devDep anymore (FR-03 dropped it from L1).
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
# Manifests + lockfile FIRST (Vercel canonical) — turbo prune emits lockfile only into out/json/.
# Two-step COPY enables Docker layer cache for pnpm install when sources change but manifests don't.
COPY --from=pruner /app/out/json/ ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ ./
ARG APP_NAME
RUN pnpm exec turbo run build --filter=@email-platform/${APP_NAME}

# Build metadata (preserved from current Dockerfile lines 95-97 — don't drop)
ARG BUILD_COMMIT=local
ARG BUILD_BRANCH=local
RUN echo "{\"commit\":\"${BUILD_COMMIT}\",\"branch\":\"${BUILD_BRANCH}\",\"built\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > /app/build-info.json

# Download grpc_health_probe binary per-arch (I-S2.1.5 + I-S2.1.6 preserved)
ARG GRPC_HEALTH_PROBE_VERSION
RUN apk add --no-cache wget \
    && wget -qO/usr/local/bin/grpc_health_probe \
        "https://github.com/grpc-ecosystem/grpc-health-probe/releases/download/${GRPC_HEALTH_PROBE_VERSION}/grpc_health_probe-linux-$(apk --print-arch | sed 's/x86_64/amd64/;s/aarch64/arm64/')" \
    && chmod +x /usr/local/bin/grpc_health_probe

# ─── Stage 2: Runner (distroless, non-root — FR-07 + FR-11) ───
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runner

# I-S2.1.5: grpc_health_probe binary
COPY --from=builder /usr/local/bin/grpc_health_probe /usr/local/bin/grpc_health_probe

ARG APP_NAME
# pnpm-workspace runtime closure (Vercel two-install canonical):
# pnpm install --prod creates a hoisted .pnpm store at the workspace root
# /app/node_modules/, and per-app /app/apps/${APP_NAME}/node_modules/ with
# the symlinks the app actually consumes. Both must travel together; the
# resolver walks up from cwd (/app/apps/${APP_NAME}) finding the app-local
# node_modules first then the root store.
#
# - /app/node_modules                from prod-deps (shared .pnpm store)
# - /app/apps/${APP_NAME}/node_modules from prod-deps (per-app symlinks)
# - /app/packages                    from builder   (compiled dist/ from turbo build)
# - /app/apps/${APP_NAME}/dist       from builder   (the app's compiled output)
# - /app/build-info.json             from builder   (CI metadata)
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=prod-deps /app/apps/${APP_NAME}/node_modules /app/apps/${APP_NAME}/node_modules
COPY --from=builder /app/packages /app/packages
COPY --from=builder /app/apps/${APP_NAME}/dist /app/apps/${APP_NAME}/dist
COPY --from=builder /app/build-info.json /app/build-info.json
# /app/proto/ — runtime proto-loader path per .env.docker `PROTO_DIR=/app/proto`.
# F-05 single-source-of-truth (PROTO_DIR value in .env.docker only) preserved;
# physical files MUST exist at /app/proto for ts-proto/grpc-js loader at runtime.
COPY --from=builder /app/packages/contracts/proto /app/proto

# WORKDIR last — Node module resolution starts from cwd; setting WORKDIR to
# the app dir means require() walks /app/apps/${APP_NAME}/node_modules then
# /app/apps/node_modules then /app/node_modules.
WORKDIR /app/apps/${APP_NAME}

# I-S0.4: NO `ENV PROTO_DIR=...` — F-05 preserved
ENV NODE_ENV=production

# I-S2.8 + I-S2.2: USER LAST + numeric form (distroless без /etc/passwd)
USER 65532:65532

# I-S2.9: exec-form CMD — distroless nodejs ENTRYPOINT is `/nodejs/bin/node`,
# so CMD passes ONLY the script path (no leading "node" — that resolves as
# module-name lookup → MODULE_NOT_FOUND). Distroless canonical form.
CMD ["dist/main.js"]
