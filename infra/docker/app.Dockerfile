# syntax=docker/dockerfile:1
ARG NODE_VERSION=22-alpine

# ─── Stage 1: Builder ─────────────────────────────────────────
FROM node:${NODE_VERSION} AS builder

RUN apk add --no-cache libc6-compat

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Step 1: Copy manifests only (layer cache for dependencies)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/foundation/package.json packages/foundation/package.json

ARG APP_NAME
COPY apps/${APP_NAME}/package.json apps/${APP_NAME}/package.json

# Step 2: Install with BuildKit cache mount
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Step 3: Copy source code (changes here don't bust install cache)
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/${APP_NAME} ./apps/${APP_NAME}

# Step 4a: Generate proto TypeScript, then build shared packages in dependency order.
# These build into packages/*/dist/ in source workspace.
RUN pnpm --filter @email-platform/contracts run generate \
    && pnpm --filter @email-platform/contracts run build \
    && pnpm --filter @email-platform/config run build \
    && pnpm --filter @email-platform/foundation run build

# Step 4b: Refresh injected workspace dependencies before app build.
# pnpm 11 with injectWorkspacePackages=true snapshots workspace package contents
# at install time. After Step 4a fills source dist/, injected copies in
# node_modules/.pnpm/@email-platform+* remain stale. `pnpm install --force` does
# NOT refresh them (verified empirically — pnpm reports "already up to date"
# even with new dist/). The only refresh path: remove node_modules entirely
# and reinstall, which forces fresh injection from current source.
# Content-addressable pnpm store at /pnpm/store survives this so re-resolve
# is fast (no network fetches). This is the canonical pattern for pnpm 11
# multi-stage Docker builds with injectWorkspacePackages.
RUN rm -rf node_modules apps/*/node_modules packages/*/node_modules
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Step 4c: Now build the app — its node_modules contain re-injected dist/ from packages.
RUN pnpm --filter @email-platform/${APP_NAME} run build

# Step 4d: Refresh once more so deploy bundles the just-built app dist/.
RUN rm -rf node_modules apps/*/node_modules packages/*/node_modules
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Step 5: Deploy production bundle
RUN pnpm deploy --filter @email-platform/${APP_NAME} --prod /prod/app

# Step 6: Ensure proto files are available
COPY packages/contracts/proto /prod/app/proto

# ─── Stage 2: Runner ──────────────────────────────────────────
FROM node:${NODE_VERSION} AS runner

RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001 -G appgroup

WORKDIR /app

COPY --from=builder /prod/app ./

ARG BUILD_COMMIT=local
ARG BUILD_BRANCH=local
RUN echo "{\"commit\":\"${BUILD_COMMIT}\",\"branch\":\"${BUILD_BRANCH}\",\"built\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > /app/build-info.json

USER appuser

# Ecosystem-level: V8/Express runtime optimizations (NOT read by app config)
ENV NODE_ENV=production
ENV PROTO_DIR=/app/proto

CMD ["node", "dist/main.js"]
