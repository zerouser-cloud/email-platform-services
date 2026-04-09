---
phase: 22-s3-storagemodule
plan: 02
subsystem: infra
tags: [s3, storage, nestjs, di, health-check, parser, notifier]

requires:
  - phase: 22-s3-storagemodule
    provides: StorageModule.forRootAsync({ bucket, token }) and ReportsStorageModule.forRootAsync() in foundation, STORAGE_HEALTH + REPORTS_STORAGE Symbol DI tokens, HEALTH.INDICATOR.S3 constant
provides:
  - Parser service wired to StorageModule (own 'parser' bucket) + ReportsStorageModule (shared reports bucket)
  - Notifier service wired to ReportsStorageModule (reports bucket only)
  - PARSER_STORAGE Symbol DI token in parser
  - ParserStorageModule wrapper in apps/parser/src/infrastructure/storage/
  - NotifierStorageModule wrapper in apps/notifier/src/infrastructure/storage/
  - Parser health readiness check includes S3 indicator alongside PostgreSQL
  - Notifier health readiness check includes S3 indicator alongside RabbitMQ
affects: [future parser/notifier business logic -- can inject PARSER_STORAGE / REPORTS_STORAGE StoragePort]

tech-stack:
  added: []
  patterns:
    - "Per-service storage wrapper module in infrastructure/storage/ layer (not root module) mirrors CacheModule integration pattern from 21-02"
    - "Root modules import pre-configured wrapper (ParserStorageModule / NotifierStorageModule), never StorageModule.forRootAsync directly, per D-06"
    - "Health indicator injection via Symbol DI token (STORAGE_HEALTH) + type-only import of StorageHealthIndicator from foundation barrel"

key-files:
  created:
    - apps/parser/src/infrastructure/storage/parser-storage.module.ts
    - apps/parser/src/infrastructure/storage/index.ts
    - apps/notifier/src/infrastructure/storage/notifier-storage.module.ts
    - apps/notifier/src/infrastructure/storage/index.ts
  modified:
    - apps/parser/src/parser.constants.ts
    - apps/parser/src/parser.module.ts
    - apps/parser/src/health/health.controller.ts
    - apps/notifier/src/notifier.module.ts
    - apps/notifier/src/health/health.controller.ts

key-decisions:
  - "Followed plan as specified — no architectural changes needed; Wave 1 (22-01) already provided all foundation primitives"
  - "Notifier constants file left untouched per plan: notifier only consumes REPORTS_STORAGE (defined in foundation), so no new service-local Symbol was required"
  - "ParserStorageModule composes BOTH StorageModule + ReportsStorageModule inside its own imports/exports, so parser code can inject PARSER_STORAGE for its own bucket and REPORTS_STORAGE for shared reports; NotifierStorageModule re-exports only ReportsStorageModule since notifier never uploads its own files"

patterns-established:
  - "Per-service storage integration: wrapper module in infrastructure/storage/{service}-storage.module.ts with static forRootAsync() delegating to foundation StorageModule / ReportsStorageModule"
  - "Multi-indicator readiness: health controller accumulates checks via @Inject(TOKEN) pattern — each infrastructure concern (DB, cache, storage, queue) injected separately and composed inside readiness()"
  - "Service-local bucket names are inline literals at module config time (bucket: 'parser') mirroring how sender inlines namespace: 'sender' in CacheModule wiring — established precedent from 21-02"

requirements-completed: [S3-03, S3-04]

duration: ~15min
completed: 2026-04-09
---

# Phase 22 Plan 02: Parser & Notifier StorageModule Integration Summary

**Per-service StorageModule wiring in parser and notifier — wrapper modules in infrastructure/storage/, PARSER_STORAGE Symbol DI token, and S3 health indicators injected into both services' readiness checks.**

## Performance

- **Duration:** ~15 min (including worktree bootstrap)
- **Started:** 2026-04-09T06:52:00Z
- **Completed:** 2026-04-09T07:06:49Z
- **Tasks:** 2
- **Files modified:** 9 (4 created, 5 modified)

## Accomplishments

- `ParserStorageModule.forRootAsync()` wraps both `StorageModule.forRootAsync({ bucket: 'parser', token: PARSER_STORAGE })` AND `ReportsStorageModule.forRootAsync()`, so parser gets its own bucket + shared reports bucket from a single import
- `NotifierStorageModule.forRootAsync()` wraps only `ReportsStorageModule.forRootAsync()` — notifier reads/signs but never uploads its own files (per D-10, D-11)
- `PARSER_STORAGE` Symbol DI token added to `apps/parser/src/parser.constants.ts`
- Both wrapper modules live in `apps/{service}/src/infrastructure/storage/` per D-05 (Clean/DDD/Hexagonal — infrastructure layer)
- Root modules (`parser.module.ts`, `notifier.module.ts`) import the wrappers via `./infrastructure/storage` barrel, NEVER calling `StorageModule.forRootAsync()` directly per D-06
- Parser `HealthController` readiness now checks PostgreSQL + S3 via `HEALTH.INDICATOR.POSTGRESQL` and `HEALTH.INDICATOR.S3`
- Notifier `HealthController` readiness now checks RabbitMQ + S3 via `HEALTH.INDICATOR.RABBITMQ` and `HEALTH.INDICATOR.S3`
- Both health controllers inject `StorageHealthIndicator` via `@Inject(STORAGE_HEALTH)` Symbol DI token with a type-only import — no class-based DI, no magic string tokens
- Full monorepo build passes: `pnpm build` — 10 successful, 10 total
- Zero `MINIO_` references anywhere under `apps/` (only in docker-compose container internals, outside repo scope)

## Task Commits

Each task was committed atomically with `--no-verify` (parallel executor mode):

1. **Task 1: Wire StorageModule into parser and notifier services** — `44382e4` (feat)
2. **Task 2: Add S3 health indicators to parser and notifier readiness** — `70f6914` (feat)

## Files Created/Modified

### Created (4 files)

- `apps/parser/src/infrastructure/storage/parser-storage.module.ts` — `ParserStorageModule` wrapper class with static `forRootAsync()` composing `StorageModule.forRootAsync({ bucket: 'parser', token: PARSER_STORAGE })` + `ReportsStorageModule.forRootAsync()` in its own `imports` and re-exporting both in `exports`
- `apps/parser/src/infrastructure/storage/index.ts` — barrel re-export `ParserStorageModule`
- `apps/notifier/src/infrastructure/storage/notifier-storage.module.ts` — `NotifierStorageModule` wrapper class with static `forRootAsync()` composing `ReportsStorageModule.forRootAsync()` only
- `apps/notifier/src/infrastructure/storage/index.ts` — barrel re-export `NotifierStorageModule`

### Modified (5 files)

- `apps/parser/src/parser.constants.ts` — added `export const PARSER_STORAGE = Symbol('ParserStorage');`
- `apps/parser/src/parser.module.ts` — added `ParserStorageModule` import from `./infrastructure/storage` and `ParserStorageModule.forRootAsync()` entry in the `imports` array (placed after `PersistenceModule.forRootAsync()`, before `LoggingModule.forGrpcAsync('parser')`)
- `apps/parser/src/health/health.controller.ts` — added `STORAGE_HEALTH`, `StorageHealthIndicator` imports; added `@Inject(STORAGE_HEALTH) private readonly storage: StorageHealthIndicator` constructor parameter; added `() => this.storage.isHealthy(HEALTH.INDICATOR.S3)` to `readiness()` checks array
- `apps/notifier/src/notifier.module.ts` — added `NotifierStorageModule` import from `./infrastructure/storage` and `NotifierStorageModule.forRootAsync()` entry in the `imports` array
- `apps/notifier/src/health/health.controller.ts` — added `STORAGE_HEALTH`, `StorageHealthIndicator` imports; added `@Inject(STORAGE_HEALTH) private readonly storage: StorageHealthIndicator` constructor parameter; added `() => this.storage.isHealthy(HEALTH.INDICATOR.S3)` to `readiness()` checks array

## Decisions Made

- **Plan executed exactly as specified** — all architectural decisions (D-05 through D-11) were pre-resolved during phase context / planning. No new decisions required during execution.
- **Notifier constants file intentionally untouched** — plan specified notifier uses only the shared `REPORTS_STORAGE` token from foundation, so no service-local Symbol was created. Checking `notifier.constants.ts` post-execution confirms only `HANDLE_EVENT_PORT` and `NOTIFICATION_SENDER_PORT` exist (unchanged).
- **Inline bucket literal `'parser'`** — follows established 21-02 precedent (`CacheModule.forRootAsync({ namespace: 'sender' })` in `apps/sender/src/sender.module.ts`). Per-service tuning at module config time is allowed inline; this matches the `no-magic-values` skill decision tree branch "Used in one file only → local" (the string appears exactly once in the codebase, at the module config site).
- **Wrapper module composes foundation modules in `imports` array (not by returning foundation's DynamicModule)** — returning `StorageModule.forRootAsync(...)` directly would lose the ability to combine it with `ReportsStorageModule.forRootAsync()` for parser. Using our own `DynamicModule` with a nested `imports` array gives parser both buckets from a single import. This is a standard NestJS composite-module pattern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Ran `pnpm install` at worktree root before executing tasks**
- **Found during:** Pre-Task 1 environment check
- **Issue:** Fresh git worktree had no `node_modules`. TypeScript compiler and all dependencies were absent, so `pnpm build` verification could not run.
- **Fix:** Ran `pnpm install --prefer-offline` at worktree root. Deterministic — matches existing `pnpm-lock.yaml`.
- **Files modified:** None (creates `node_modules/` which is gitignored)
- **Verification:** `pnpm build --filter=@email-platform/config --filter=@email-platform/foundation --filter=@email-platform/contracts` succeeds
- **Committed in:** No commit (filesystem-only)

**2. [Rule 3 - Blocking] Hard-reset worktree to correct base commit `1098e5b`**
- **Found during:** Worktree branch check (first action per task instructions)
- **Issue:** Worktree branch was created from `origin/main` (04b25cb) — an older commit that predates the entire feature branch including Wave 1's StorageModule. Running `git reset --soft 1098e5b` as instructed moved HEAD forward but left the working tree at the old state, showing 140+ files as "deleted" relative to the new HEAD (all the feature-branch artifacts were missing from disk).
- **Fix:** Ran `git reset --hard 1098e5bc97693c3e081b5dba40fdc4e796dc554d` to materialize the complete target-base working tree, making Wave 1 foundation StorageModule files available on disk for parser/notifier to import.
- **Files modified:** None directly (git working tree state only, no commit)
- **Verification:** `git log --oneline -3` shows `1098e5b`, `f25839a`, `2cb1bce` (Wave 1 commits present); `ls packages/foundation/src/storage/` shows all 9 Wave 1 storage files
- **Committed in:** No commit (git state only)

---

**Total deviations:** 2 auto-fixed (both blocking). No scope creep. Both fixes were filesystem/workspace bootstrap issues, not code changes. The plan itself executed exactly as written.

## Issues Encountered

- **Turbo filter name mismatch on first build:** Plan's verification block used `pnpm build --filter=parser --filter=notifier`, but the actual package names are `@email-platform/parser` and `@email-platform/notifier` (turbo rejected the short names with `No package found with name 'parser' in workspace`). Re-ran with fully-qualified filter names; build succeeded. Minor friction, no code impact.

## Threat Mitigations Applied

Both threats in the plan's `<threat_model>` are addressed:

| Threat ID | Status | How addressed |
|-----------|--------|---------------|
| T-22-05 (Tampering: parser bucket isolation) | Mitigated | `PARSER_STORAGE` Symbol (parser-only, scoped by the `parser-storage.module.ts` wrapper) is separate from `REPORTS_STORAGE` Symbol (foundation-scoped). Parser code must explicitly inject one or the other — no shared identifier that could accidentally hit the wrong bucket |
| T-22-06 (Spoofing: health endpoint) | Accepted (per plan) | Health endpoints remain unauthenticated by design (standard k8s/docker pattern). No change from plan disposition |

## User Setup Required

None. Wave 1 already installed AWS SDK dependencies, `STORAGE_*` env vars already exist in `.env` / `.env.docker` per D-12, and MinIO/Garage are already running per Phase 18.1 deployment.

## Next Phase Readiness

- Parser business logic can inject `@Inject(PARSER_STORAGE) storage: StoragePort` for its own bucket and `@Inject(REPORTS_STORAGE) reports: StoragePort` for the shared reports bucket
- Notifier business logic can inject `@Inject(REPORTS_STORAGE) reports: StoragePort` for downloading + generating signed URLs for Telegram delivery (per D-10/D-11 flow)
- Per-service storage pattern is now established; sender/audience can follow the same pattern when they need S3 access:
  1. Add a Symbol DI token to their `*.constants.ts`
  2. Create `infrastructure/storage/{service}-storage.module.ts` wrapper
  3. Import the wrapper in the root module
  4. Inject `STORAGE_HEALTH` in the health controller
- All four Phase 22 requirements are now complete: `S3-01` + `S3-02` + `S3-03` via Plan 22-01, `S3-03` + `S3-04` via Plan 22-02

## Self-Check: PASSED

**Files verified on disk:**
- FOUND: apps/parser/src/infrastructure/storage/parser-storage.module.ts
- FOUND: apps/parser/src/infrastructure/storage/index.ts
- FOUND: apps/notifier/src/infrastructure/storage/notifier-storage.module.ts
- FOUND: apps/notifier/src/infrastructure/storage/index.ts
- FOUND: apps/parser/src/parser.constants.ts (contains PARSER_STORAGE)
- FOUND: apps/parser/src/parser.module.ts (imports ParserStorageModule)
- FOUND: apps/parser/src/health/health.controller.ts (injects STORAGE_HEALTH)
- FOUND: apps/notifier/src/notifier.module.ts (imports NotifierStorageModule)
- FOUND: apps/notifier/src/health/health.controller.ts (injects STORAGE_HEALTH)

**Commits verified in git log:**
- FOUND: 44382e4 (Task 1: wire StorageModule into parser and notifier services)
- FOUND: 70f6914 (Task 2: add S3 health indicators to parser and notifier readiness)

**Builds verified:**
- parser + notifier targeted: `pnpm build --filter=@email-platform/parser --filter=@email-platform/notifier` PASS
- full workspace: `pnpm build` PASS (10 successful, 10 total)

**Acceptance criteria (Task 1):** 8/8 PASS
**Acceptance criteria (Task 2):** 6/6 PASS
**Plan verification block:** 5/5 PASS

**No stubs introduced.** StorageModule foundation is fully wired; no placeholder data or TODO markers in the new code.

**No threat flags.** No new security surface was introduced outside the plan's `<threat_model>` — parser and notifier gain S3 access exactly as the threat model anticipated, with bucket isolation via separate DI tokens (T-22-05 mitigation).

---

*Phase: 22-s3-storagemodule*
*Completed: 2026-04-09*
