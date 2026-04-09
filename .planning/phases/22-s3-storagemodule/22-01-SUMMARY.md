---
phase: 22-s3-storagemodule
plan: 01
subsystem: infra
tags: [s3, aws-sdk, minio, garage, nestjs, storage, di, health-check]

requires:
  - phase: 21-redis-cachemodule
    provides: CacheModule pattern -- forRootAsync({ options }), Symbol DI tokens, health indicator, shutdown service
provides:
  - StorageModule.forRootAsync({ bucket, token }) in foundation
  - StoragePort interface with upload/download/delete/exists/getSignedUrl
  - S3_CLIENT, STORAGE_HEALTH, REPORTS_STORAGE Symbol DI tokens
  - S3StorageService implementing StoragePort with bucket baked in
  - S3HealthIndicator using HeadBucketCommand
  - S3ShutdownService calling client.destroy() on application shutdown
  - ReportsStorageModule pre-configured for 'reports' bucket
  - HEALTH.INDICATOR.S3 = 's3' constant
affects: [22-02 per-service storage integration, parser, notifier, sender, audience]

tech-stack:
  added: [@aws-sdk/client-s3, @aws-sdk/s3-request-presigner]
  patterns:
    - StorageModule mirrors CacheModule forRootAsync pattern
    - Bucket baked in at module config time (not passed per call)
    - forcePathStyle + WHEN_REQUIRED checksums for MinIO/Garage compatibility
    - Barrel exports only abstraction (StoragePort), not raw client

key-files:
  created:
    - packages/foundation/src/storage/storage.constants.ts
    - packages/foundation/src/storage/storage.interfaces.ts
    - packages/foundation/src/storage/storage.service.ts
    - packages/foundation/src/storage/s3.health.ts
    - packages/foundation/src/storage/s3-shutdown.service.ts
    - packages/foundation/src/storage/storage.providers.ts
    - packages/foundation/src/storage/storage.module.ts
    - packages/foundation/src/storage/reports-storage.module.ts
    - packages/foundation/src/storage/index.ts
  modified:
    - packages/foundation/package.json
    - packages/foundation/src/index.ts
    - packages/foundation/src/health/health-constants.ts
    - pnpm-lock.yaml

key-decisions:
  - "Installed AWS SDK dependencies during Task 1 (blocking fix) so Task 1's build verification could actually succeed -- plan ordering put the install in Task 2 but the build check was in Task 1"
  - "ReportsStorageModule co-located in storage/ directory (not a separate subdirectory) for simpler module boundary"
  - "S3HealthIndicator instantiated via useFactory (not class auto-DI) because it needs the per-module bucket name which is only known inside forRootAsync"

patterns-established:
  - "Infrastructure modules in foundation follow PersistenceModule/CacheModule template: forRootAsync, Symbol DI tokens, providers factory, health indicator, shutdown service, barrel exports abstraction only"
  - "Per-module bucket baked in via factory provider, not passed per method call"
  - "S3_CLIENT is internal-only (not exported from barrel) -- encapsulation of raw client"
  - "Error inspection via safe type guard (isNotFoundError) instead of type assertion, keeps strict no-any compliance"

requirements-completed: [S3-01, S3-02, S3-03]

duration: ~10min
completed: 2026-04-09
---

# Phase 22 Plan 01: StorageModule Foundation Summary

**StorageModule with AWS SDK v3 in foundation -- DI-injectable StoragePort abstraction, HeadBucket health indicator, graceful shutdown, and ReportsStorageModule preset for cross-service reports bucket**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-09T06:47:00Z
- **Completed:** 2026-04-09T06:57:00Z
- **Tasks:** 2
- **Files modified:** 13 (9 created, 4 modified)

## Accomplishments

- `StorageModule.forRootAsync({ bucket, token })` available from `@email-platform/foundation`
- `StoragePort` interface with 5 methods (upload, download, delete, exists, getSignedUrl) and mandatory `expiresInMs` on signed URLs
- AWS SDK v3 (`@aws-sdk/client-s3@^3.1027.0`, `@aws-sdk/s3-request-presigner@^3.1027.0`) installed in foundation
- S3Client configured with `forcePathStyle: true` and `requestChecksumCalculation/responseChecksumValidation: 'WHEN_REQUIRED'` for MinIO/Garage compatibility
- `S3HealthIndicator` uses `HeadBucketCommand` against the module's configured bucket
- `S3ShutdownService` destroys the S3 client on `OnApplicationShutdown`
- `ReportsStorageModule.forRootAsync()` pre-configures the shared `'reports'` bucket with `REPORTS_STORAGE` Symbol token
- `HEALTH.INDICATOR.S3 = 's3'` constant available for health controllers
- Full monorepo build passes (foundation + config + 6 apps + contracts)

## Task Commits

Each task was committed atomically with `--no-verify` (parallel executor mode):

1. **Task 1: Create StorageModule with S3 client, health, shutdown, and ReportsStorageModule** — `f05e022` (feat)
2. **Task 2: Install AWS SDK, wire StorageModule into foundation barrel, add S3 health constant** — `2cb1bce` (feat)

## Files Created/Modified

### Created (9 files, all in `packages/foundation/src/storage/`)

- `storage.constants.ts` — `S3_CLIENT`, `STORAGE_HEALTH`, `REPORTS_STORAGE` Symbols + `S3_DEFAULTS`, `S3_HEALTH_CHECK`, `S3_ENDPOINT`, `S3_TIME`, `S3_ERROR_NAME` `as const` objects
- `storage.interfaces.ts` — `StoragePort`, `StorageHealthIndicator`, `StorageModuleOptions` interfaces
- `storage.service.ts` — `S3StorageService` implementing `StoragePort`; uses `PutObject`, `GetObject`, `DeleteObject`, `HeadObject` commands and `getSignedUrl` from presigner
- `s3.health.ts` — `S3HealthIndicator` using `HeadBucketCommand` for the module's bucket
- `s3-shutdown.service.ts` — `S3ShutdownService` implementing `OnApplicationShutdown` and calling `client.destroy()`
- `storage.providers.ts` — `storageProviders(options)` factory: S3 client provider (via `ConfigService`), storage service provider (via `options.token`), health indicator provider (useFactory with bucket), STORAGE_HEALTH provider (useExisting), shutdown service
- `storage.module.ts` — `StorageModule` with `forRootAsync({ bucket, token })` returning `DynamicModule`
- `reports-storage.module.ts` — `ReportsStorageModule.forRootAsync()` wrapping `StorageModule.forRootAsync({ bucket: 'reports', token: REPORTS_STORAGE })`
- `index.ts` — Barrel exports: `StorageModule`, `ReportsStorageModule`, `StoragePort` (type), `StorageHealthIndicator` (type), `StorageModuleOptions` (type), `STORAGE_HEALTH`, `REPORTS_STORAGE`, `S3_DEFAULTS`, `S3_HEALTH_CHECK`. **Deliberately NOT exported:** `S3_CLIENT`, `S3StorageService`, `S3HealthIndicator` class (D-04 -- no raw client leak)

### Modified

- `packages/foundation/package.json` — Added `@aws-sdk/client-s3@^3.1027.0` and `@aws-sdk/s3-request-presigner@^3.1027.0`
- `packages/foundation/src/index.ts` — Added `export * from './storage';` after cache export
- `packages/foundation/src/health/health-constants.ts` — Added `S3: 's3'` to `HEALTH.INDICATOR`
- `pnpm-lock.yaml` — Updated with AWS SDK transitive dependencies

## Decisions Made

- **AWS SDK install moved into Task 1 scope (deviation, documented below)** -- the plan placed the dep install in Task 2 but Task 1's build verification required the SDK to be present. Installing in Task 1 keeps task commits atomic and verifiable.
- **ReportsStorageModule co-located in `storage/reports-storage.module.ts`** (not in a separate `reports-storage/` directory) -- single responsibility is minimal, doesn't warrant its own directory.
- **Health indicator instantiated via `useFactory`** -- needs the bucket name from `forRootAsync` options, which cannot be injected through a class constructor decorator. Factory provider is the idiomatic NestJS solution.
- **Extracted all literals to `as const` constants** per `no-magic-values` skill: `S3_ENDPOINT.PROTOCOL`, `S3_ENDPOINT.PORT_SEPARATOR`, `S3_TIME.MILLIS_PER_SECOND`, `S3_ERROR_NAME.NOT_FOUND`, `S3_DEFAULTS.*`, `S3_HEALTH_CHECK.DOWN_MESSAGE`. Only exception: `bucket: 'reports'` is inlined in `ReportsStorageModule` to satisfy the plan's acceptance grep criterion, and mirrors how CacheModule usages inline namespace literals (`namespace: 'sender'`) in service modules.
- **`isNotFoundError` type guard** in `storage.service.ts` avoids `any` by doing safe `unknown -> { name?: unknown }` narrowing and comparing against `S3_ERROR_NAME.NOT_FOUND`. Keeps `@typescript-eslint/no-explicit-any: error` compliant.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed AWS SDK in Task 1 instead of Task 2**
- **Found during:** Task 1 (before running build verification)
- **Issue:** Plan placed `pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner` in Task 2, but Task 1 creates `storage.service.ts`, `s3.health.ts`, `s3-shutdown.service.ts`, and `storage.providers.ts` which all import from `@aws-sdk/client-s3`. Task 1's verification step is `cd packages/foundation && pnpm build` -- it would fail without the SDK installed. The task graph implicitly required the install to be part of Task 1.
- **Fix:** Ran `pnpm add @aws-sdk/client-s3@^3.1027.0 @aws-sdk/s3-request-presigner@^3.1027.0` in `packages/foundation` before running the Task 1 build. The package.json/lockfile edits were committed in Task 2 as the plan specified, leaving Task 1 with only the source files.
- **Files modified:** `packages/foundation/package.json`, `pnpm-lock.yaml` (both committed in Task 2, `2cb1bce`)
- **Verification:** `pnpm build --filter=@email-platform/foundation` succeeds; full `pnpm build` succeeds across all 10 workspace packages
- **Committed in:** Files landed in `2cb1bce` (Task 2 commit) per plan intent

**2. [Rule 2 - Missing Critical] Ran `pnpm install` at worktree root before Task 1**
- **Found during:** Worktree initialization (before Task 1)
- **Issue:** Fresh git worktree had no `node_modules`. TypeScript compiler and all dependencies were absent, so build verification could not run.
- **Fix:** Ran `pnpm install --prefer-offline` at worktree root. This matches the existing lockfile and produces deterministic dependencies.
- **Files modified:** None directly (creates `node_modules/` which is gitignored)
- **Verification:** `pnpm build --filter=@email-platform/foundation` succeeds
- **Committed in:** No commit (filesystem-only)

**3. [Rule 2 - Missing Critical] Built `@email-platform/config` before `@email-platform/foundation`**
- **Found during:** Task 1 verification (first build attempt)
- **Issue:** `foundation` imports types from `@email-platform/config`. On a fresh worktree, config's `dist/` directory was empty, so foundation's build failed with `TS2307: Cannot find module '@email-platform/config'` in 4 pre-existing files (`grpc-client.module.ts`, `grpc-server.factory.ts`, `log-transport.ts`, `logging.module.ts`). This is a workspace build ordering issue, not a bug in my changes.
- **Fix:** Ran `cd packages/config && pnpm build` first, then `cd packages/foundation && pnpm build`. The full `pnpm build` via Turbo handles ordering automatically but a raw direct `pnpm build` in foundation alone does not.
- **Files modified:** None directly (creates `packages/config/dist/` which is gitignored)
- **Verification:** Foundation build then succeeds with zero errors
- **Committed in:** No commit (filesystem-only)

**4. [Rule 2 - Missing Critical] Inline `bucket: 'reports'` instead of named constant**
- **Found during:** Task 1 (ReportsStorageModule creation)
- **Issue:** Initially extracted `'reports'` to a `REPORTS_BUCKET.NAME` constant per `no-magic-values` skill. However, the plan's acceptance criterion `grep "bucket: 'reports'"` required the literal string. Also, established CacheModule precedent in `apps/sender/src/sender.module.ts` inlines `namespace: 'sender'` at the module level, so this pattern is consistent.
- **Fix:** Inlined the literal in `reports-storage.module.ts` and removed the unused constant. The literal appears exactly once in the codebase at the module config site -- analogous to namespace literals for CacheModule.
- **Files modified:** `packages/foundation/src/storage/reports-storage.module.ts`, `packages/foundation/src/storage/storage.constants.ts`
- **Verification:** Grep criterion passes; build passes
- **Committed in:** `f05e022` (Task 1 commit)

---

**Total deviations:** 4 auto-fixed (1 blocking, 3 missing critical)
**Impact on plan:** All auto-fixes necessary for execution to succeed. No scope creep. Filesystem bootstrap (install, dep ordering) is not scope, and the inline bucket literal is a precedent-matching adjustment. SDK install was always intended to happen in this plan -- only the task boundary shifted.

## Issues Encountered

- **Worktree base mismatch at startup:** The worktree HEAD was at `04b25cb` (much newer than expected `5c07b30`). Following the `<worktree_branch_check>` protocol, I ran `git reset --soft 5c07b30aa90b063f066c1759f3f29c50a886abb4` and then `git checkout HEAD -- .` to restore the working tree to match the expected base. Two untracked files remained (`packages/config/src/infrastructure.ts` and `packages/foundation/src/health/indicators/redis.health.ts`) from prior worktree state -- these were NOT touched, as they are out of scope for this plan.

## User Setup Required

None -- no external service configuration required. MinIO/Garage are already running in the environment per Phase 18.1 deployment. The new module will be wired to per-service configs in Plan 02 (22-02).

## Next Phase Readiness

- `StorageModule.forRootAsync({ bucket, token })` and `ReportsStorageModule.forRootAsync()` are ready for service integration in Plan 02 (22-02)
- Parser and notifier can import `ReportsStorageModule` to share the cross-service `reports` bucket
- Each service can create an `infrastructure/storage/{service}-storage.module.ts` wrapper per D-05/D-06 pattern (mirrors how `SenderStorageModule` would follow the `CacheModule` pattern)
- `STORAGE_*` env vars already exist in `.env` and `.env.docker` (per D-12, S3-03 done in v3.0)
- `HEALTH.INDICATOR.S3` constant is ready for health controllers to inject `STORAGE_HEALTH` DI token

## Self-Check: PASSED

**Files verified on disk:**
- FOUND: packages/foundation/src/storage/storage.constants.ts
- FOUND: packages/foundation/src/storage/storage.interfaces.ts
- FOUND: packages/foundation/src/storage/storage.service.ts
- FOUND: packages/foundation/src/storage/s3.health.ts
- FOUND: packages/foundation/src/storage/s3-shutdown.service.ts
- FOUND: packages/foundation/src/storage/storage.providers.ts
- FOUND: packages/foundation/src/storage/storage.module.ts
- FOUND: packages/foundation/src/storage/reports-storage.module.ts
- FOUND: packages/foundation/src/storage/index.ts

**Commits verified in git log:**
- FOUND: f05e022 (Task 1: create StorageModule)
- FOUND: 2cb1bce (Task 2: install AWS SDK, wire barrel, add S3 health constant)

**Build verified:**
- foundation: `pnpm build --filter=@email-platform/foundation` PASS
- full workspace: `pnpm build` PASS (10 successful, 10 total)

**Acceptance criteria (Task 1):** 13/13 PASS
**Acceptance criteria (Task 2):** 4/4 PASS
**Plan verification block:** 5/5 PASS

---

*Phase: 22-s3-storagemodule*
*Completed: 2026-04-09*
