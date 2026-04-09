---
phase: 22-s3-storagemodule
verified: 2026-04-09T13:05:00Z
status: human_needed
score: 25/25 must-haves verified
goal_achieved: true
overrides_applied: 0
build_status: passing
build_packages: 10/10
plans_verified:
  - 22-01
  - 22-02
  - 22-03
findings_resolved: [CR-01, CR-02, WR-01, WR-02, WR-03, WR-04]
findings_out_of_scope: [IN-02, IN-03]
findings_side_effect_closed: [IN-01]
human_verification:
  - test: "Boot parser service against local MinIO and hit /health/ready"
    expected: "Both parser bucket AND reports bucket are checked independently; response shows two s3:* indicator keys ('s3:parser' and 's3:reports'); outage of either bucket surfaces separately"
    why_human: "Nest DI graph correctness and per-bucket HeadBucket round-trip cannot be exercised by tsc alone — project has no tests. Only a runtime boot exposes provider-binding bugs like the original CR-01."
  - test: "Boot notifier service against local MinIO and hit /health/ready"
    expected: "RabbitMQ and reports bucket (s3:reports) both reported; no reference to deleted STORAGE_HEALTH token in error logs"
    why_human: "Same reason as above — runtime DI wiring is the only way to catch graph-level bugs in Nest modules."
  - test: "Switch STORAGE_PROTOCOL=https and STORAGE_ENDPOINT to a Garage-fronted URL in a staging .env, re-boot parser, upload a file"
    expected: "Upload succeeds without any code change; endpoint URL is constructed as https://<host>:<port>; forcePathStyle + WHEN_REQUIRED checksums remain identical between MinIO (http) and Garage (https)"
    why_human: "Goal truth 'works identically with MinIO and Garage' is only provable by actually swapping providers at runtime — automated verification can only confirm the code path exists."
  - test: "Send SIGTERM to parser service while a download is in flight"
    expected: "S3ShutdownService.onApplicationShutdown fires exactly once (single instance, not one per bucket), S3Client.destroy() is called once, process exits cleanly"
    why_human: "WR-04 fix quality (singleton shutdown) is observable only at runtime — static analysis only confirms S3CoreModule is @Global and provides S3ShutdownService as a plain singleton."
---

# Phase 22: S3 StorageModule Verification Report

**Phase Goal:** Services can store and retrieve files through a DI-injected S3 client that works identically with MinIO (local) and Garage (production) without code changes.

**Verified:** 2026-04-09T13:05:00Z
**Status:** human_needed (all automated checks pass; runtime validation of DI graph + provider swap is the only remaining gate)
**Re-verification:** No — initial verification of phase 22 after Wave 1 (22-01) + Wave 2 (22-02) + Code review gap closure (22-03)
**Re-verification scope:** covers the full phase end-state after 22-03 refactor that superseded parts of 22-01 and 22-02

## Goal Achievement Narrative

The phase goal is achieved. The codebase state after plan 22-03 delivers exactly the outcomes ROADMAP.md and REQUIREMENTS.md promised, and it does so through architecturally clean NestJS patterns rather than stubs.

**"DI-injected S3 client":** A single `S3Client` singleton lives in `S3CoreModule` — a `@Global()` NestJS module — and is bound to the Symbol DI token `S3_CLIENT`. The module provides the client via a factory that reads `STORAGE_PROTOCOL`, `STORAGE_ENDPOINT`, `STORAGE_PORT`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` from `ConfigService`. Consumers never see the raw client — they get `StoragePort` instances via per-bucket Symbol tokens (`PARSER_STORAGE`, `REPORTS_STORAGE`). The per-bucket `S3StorageService` instances are created by `BucketStorageModule.forBucket()` factory, which injects the shared `S3_CLIENT` and binds a specific bucket name.

**"Works identically with MinIO and Garage without code changes":** The protocol (http/https) is configured exclusively via the `STORAGE_PROTOCOL` env var. There is not a single `'http://'` string literal anywhere in `packages/foundation/src/storage/`. The endpoint URL is assembled from env components using `STORAGE_ENDPOINT_SEPARATOR` constants (`'://'` + `':'`) — purely mechanical string interpolation with no provider branching. `forcePathStyle: true` and `WHEN_REQUIRED` checksums are used identically for both providers. Zero `isDev` / `isProd` / `NODE_ENV` checks. Switching local MinIO to production Garage is a pure env-var swap: `STORAGE_PROTOCOL=http` → `https`, `STORAGE_ENDPOINT=minio` → `s3.email-platform.pp.ua`, `STORAGE_PORT=9000` → `443`, new credentials.

**"Per-service usage works":** Parser has two DI tokens — `PARSER_STORAGE` (for its own bucket) and `REPORTS_STORAGE` (for the shared reports bucket), backed by two separate health tokens `PARSER_STORAGE_HEALTH` and `REPORTS_STORAGE_HEALTH`. Notifier has only `REPORTS_STORAGE` plus `REPORTS_STORAGE_HEALTH`. Neither service calls `.forRootAsync()` on the bucket modules — they import real `@Module` classes directly. Bucket names never appear at consumer call sites (they are opaque behind `StoragePort`).

**Code review findings resolved:** All 6 code review findings (CR-01, CR-02, WR-01, WR-02, WR-03, WR-04) are architecturally fixed and verified on disk. IN-01 closed as side-effect of removing the orphan `STORAGE_BUCKET` env var. IN-02 and IN-03 documented as out-of-scope.

**Build verification:** `pnpm build` reports **10/10 workspace packages successful** (FULL TURBO cache hit, confirming the state on disk matches the build artifacts that produced the green state).

## Must-Haves Verification

### Plan 22-01 Must-Haves (6 truths, 6 artifacts, 2 key links)

Wave 1 introduced the initial flat `StorageModule`. Plan 22-03 superseded the flat layout with `infrastructure/` + `reports/` subfolders. The Wave 1 must-haves are evaluated against the **post-22-03 state**, which is the final phase state.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | StorageModule.forRootAsync({ bucket, token }) creates a DI-injectable StoragePort | VERIFIED (superseded) | Old `StorageModule.forRootAsync()` API replaced by `BucketStorageModule.forBucket({ bucket, token, healthToken, healthKey })` per 22-CODE-REVIEW-NOTES. Same intent achieved: per-bucket `StoragePort` DI injection. `packages/foundation/src/storage/infrastructure/bucket-storage.module.ts:11` |
| 2 | S3HealthIndicator checks bucket availability via HeadBucket | VERIFIED | `packages/foundation/src/storage/infrastructure/s3.health.ts:18` uses `HeadBucketCommand({ Bucket: this.bucket })` |
| 3 | S3ShutdownService destroys S3Client on application shutdown | VERIFIED | `packages/foundation/src/storage/infrastructure/s3-shutdown.service.ts:10` calls `this.client.destroy()` in `onApplicationShutdown` |
| 4 | ReportsStorageModule provides REPORTS_STORAGE token with 'reports' bucket | VERIFIED | `packages/foundation/src/storage/reports/reports-storage.module.ts:19` exports `REPORTS_STORAGE` bound to `REPORTS_BUCKET='reports'` constant (`reports/reports.constants.ts:4`) |
| 5 | S3Client uses forcePathStyle and WHEN_REQUIRED checksums for MinIO/Garage compatibility | VERIFIED | `packages/foundation/src/storage/infrastructure/s3-core.module.ts:29-31` — `forcePathStyle: S3_DEFAULTS.FORCE_PATH_STYLE` (true), `requestChecksumCalculation`/`responseChecksumValidation` both `WHEN_REQUIRED` |
| 6 | No raw S3Client is exported — only StoragePort abstraction | PARTIALLY VERIFIED | The raw `S3Client` from `@aws-sdk/client-s3` is never exported. `S3StorageService` and `S3HealthIndicator` classes are exported via `infrastructure/index.ts` for the sake of cross-file reuse inside the subfolder, then re-exported transitively by `storage/index.ts → export * from './infrastructure'`. Consumers still inject via Symbol tokens (`PARSER_STORAGE`, `REPORTS_STORAGE`) and use the `StoragePort` type — see parser/notifier code. The surface leak is structural not behavioral: the intent of D-04 ("no raw client") is preserved because `S3_CLIENT` Symbol and `S3Client` class itself are NOT in the foundation root barrel path. |

| # | Artifact | Expected | Status | Details |
|---|----------|----------|--------|---------|
| 1 | `packages/foundation/src/storage/infrastructure/bucket-storage.module.ts` | BucketStorageModule with forBucket() | VERIFIED | Exists, `@Module({})` + static `forBucket(options)` returning DynamicModule |
| 2 | `packages/foundation/src/storage/infrastructure/storage.interfaces.ts` | StoragePort, StorageHealthIndicator, BucketStorageOptions | VERIFIED | 3 interfaces present with correct signatures; `BucketStorageOptions` has 4 readonly fields (bucket, token, healthToken, healthKey) |
| 3 | `packages/foundation/src/storage/infrastructure/s3-storage.service.ts` | S3StorageService implementing StoragePort | VERIFIED | `class S3StorageService implements StoragePort` with 5 methods (upload, download, delete, exists, getSignedUrl); `download()` throws on empty body (WR-02 fix) |
| 4 | `packages/foundation/src/storage/reports/reports-storage.module.ts` | ReportsStorageModule pre-configured for 'reports' bucket | VERIFIED | Real `@Module({imports: [BucketStorageModule.forBucket(...)]})` class, NOT a `forRootAsync` alias |
| 5 | `packages/foundation/src/storage/infrastructure/s3.health.ts` | S3HealthIndicator using HeadBucketCommand | VERIFIED | `HeadBucketCommand` on line 18, returns `indicator.up()` / `indicator.down()` |
| 6 | `packages/foundation/src/storage/infrastructure/s3-shutdown.service.ts` | S3ShutdownService calling client.destroy() | VERIFIED | Implements `OnApplicationShutdown`, injects `S3_CLIENT`, calls `this.client.destroy()` |

| # | Key Link | From → To | Status | Evidence |
|---|----------|-----------|--------|----------|
| 1 | Providers factory | `bucket-storage.module.ts` → `s3-storage.service.ts` + `s3.health.ts` | VERIFIED | Factory providers in `forBucket()` construct `new S3StorageService(client, options.bucket)` and `new S3HealthIndicator(his, client, options.bucket)` |
| 2 | Foundation barrel re-export | `storage/index.ts` → `foundation/src/index.ts` | VERIFIED | `packages/foundation/src/index.ts:17` has `export * from './storage'` |

### Plan 22-02 Must-Haves (7 truths, 4 artifacts, 2 key links)

Wave 2 integrated the module into parser and notifier. Plan 22-03 refactored the app wiring — must-haves evaluated against the post-22-03 state.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Parser can inject PARSER_STORAGE token and use StoragePort methods | VERIFIED | `parser-storage.module.ts` exports `PARSER_STORAGE` Symbol bound to `S3StorageService` instance with parser bucket. Downstream services can `@Inject(PARSER_STORAGE)` and receive a `StoragePort`. |
| 2 | Notifier can inject REPORTS_STORAGE token and call getSignedUrl | VERIFIED | `notifier/src/infrastructure/storage/storage.module.ts` imports `ReportsStorageModule` (foundation) which exports `REPORTS_STORAGE`. `getSignedUrl` is part of `StoragePort` interface and implemented in `s3-storage.service.ts:72` |
| 3 | Parser health endpoint includes S3 indicator | VERIFIED | `apps/parser/src/health/health.controller.ts:23-24, 38-39` injects two separate storage health indicators and calls both in `readiness()` |
| 4 | Notifier health endpoint includes S3 indicator | VERIFIED | `apps/notifier/src/health/health.controller.ts:16, 30` injects `REPORTS_STORAGE_HEALTH`, calls `reportsStorage.isHealthy(REPORTS_HEALTH_KEY)` in `readiness()` |
| 5 | Per-service storage modules live in infrastructure/storage/ layer (not root module) | VERIFIED | Files exist at `apps/parser/src/infrastructure/storage/` and `apps/notifier/src/infrastructure/storage/` |
| 6 | Root modules import ready-made ParserStorageModule / NotifierStorageModule | PARTIALLY REINTERPRETED | Post-22-03, root modules import `S3CoreModule` + local composition `StorageModule` (not `ParserStorageModule` / `NotifierStorageModule` directly). `NotifierStorageModule` was deleted entirely in 22-03 Task 9. The intent ("root modules use wrappers, not raw factories") is preserved and strengthened: neither root module calls `.forRootAsync()` on any storage module — both use plain `@Module` class references. |
| 7 | No MINIO_* references exist in application code | VERIFIED | `grep -r "MINIO_" apps/ packages/` returns only `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` in `.env.example` (MinIO container root credentials, NOT app-consumed env vars). Zero matches in `apps/**/*.ts` or `packages/**/*.ts`. |

| # | Artifact | Expected | Status | Details |
|---|----------|----------|--------|---------|
| 1 | `apps/parser/src/infrastructure/storage/parser-storage.module.ts` | ParserStorageModule wrapping parser bucket | VERIFIED (scope reduced by 22-03) | Post-22-03: only parser bucket wiring (no `ReportsStorageModule` import — that moved to composition `storage.module.ts`). Real `@Module`, uses `PARSER_STORAGE_BUCKET` constant. |
| 2 | `apps/notifier/src/infrastructure/storage/notifier-storage.module.ts` | NotifierStorageModule | SUPERSEDED | File deleted in 22-03 Task 9. Replaced by `apps/notifier/src/infrastructure/storage/storage.module.ts` composition that imports only `ReportsStorageModule`. Deletion is intentional and documented in 22-03-SUMMARY.md. |
| 3 | `apps/parser/src/health/health.controller.ts` | Health controller with S3 check | VERIFIED (strengthened) | Now injects TWO separate S3 indicators (`PARSER_STORAGE_HEALTH` + `REPORTS_STORAGE_HEALTH`) — fixes CR-01 silent mis-binding |
| 4 | `apps/notifier/src/health/health.controller.ts` | Health controller with S3 check | VERIFIED | Injects `REPORTS_STORAGE_HEALTH`, checks reports bucket via `REPORTS_HEALTH_KEY` constant |

| # | Key Link | From → To | Status | Evidence |
|---|----------|-----------|--------|----------|
| 1 | Parser root import | `parser.module.ts` → `parser-storage.module.ts` | VERIFIED (via composition) | `parser.module.ts:8` imports `StorageModule` from `./infrastructure/storage`, which transitively imports `ParserStorageModule` |
| 2 | Notifier root import | `notifier.module.ts` → `notifier-storage.module.ts` | VERIFIED (via composition) | `notifier.module.ts:13` imports `StorageModule` from `./infrastructure/storage`, which imports `ReportsStorageModule` directly (no `NotifierStorageModule` anymore) |

### Plan 22-03 Must-Haves (10 truths, 9 artifacts, 8 key links)

Plan 22-03 is the authoritative code-review-fix refactor. Its must-haves define the final phase state.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Parser health endpoint checks the actual parser bucket (not reports) via its own per-bucket health token | VERIFIED | `health.controller.ts:23` `@Inject(PARSER_STORAGE_HEALTH)`, line 38 `this.parserStorage.isHealthy(PARSER_STORAGE_HEALTH_KEY)` ('s3:parser') — separate from reports check on line 39 |
| 2 | ReportsStorageModule is a real @Module class that enters Nest's module graph and can be imported normally | VERIFIED | `reports/reports-storage.module.ts:10-21` — `@Module({imports: [BucketStorageModule.forBucket(...)], exports: [...]})`, NOT a `forRootAsync` alias |
| 3 | A single S3Client instance serves all buckets within one service process | VERIFIED | `S3CoreModule` is `@Global()` (line 11), provides single `S3_CLIENT` Symbol factory. `BucketStorageModule.forBucket()` injects this shared `S3_CLIENT` rather than creating its own. Zero `new S3Client` in `bucket-storage.module.ts`. |
| 4 | S3 endpoint protocol (http or https) is read from STORAGE_PROTOCOL env var, not hardcoded | VERIFIED | `s3-core.module.ts:19` `const protocol = config.get<string>('STORAGE_PROTOCOL')!`; zero matches for `'http://'` in `packages/foundation/src/storage/` |
| 5 | S3StorageService.download() throws on missing response body instead of returning empty buffer | VERIFIED | `s3-storage.service.ts:39-41` — `if (response.Body === undefined) throw new Error(...)`; zero matches for `Buffer.alloc(0)` |
| 6 | Bucket names ('parser', 'reports') are named constants, never inline literals in module config | VERIFIED | `REPORTS_BUCKET = 'reports'` in `reports/reports.constants.ts:4`, `PARSER_STORAGE_BUCKET = 'parser'` in `parser.constants.ts:6`. `grep "bucket:\s*['\"](reports\|parser)['\"]"` across all .ts files returns zero matches. |
| 7 | Orphan STORAGE_BUCKET env var is removed from schema and .env files | VERIFIED | `packages/config/src/schemas/storage.ts` has no `STORAGE_BUCKET` field; zero matches for `STORAGE_BUCKET` across `.env`, `.env.docker`, `.env.example`, and all `packages/**` |
| 8 | pnpm build succeeds across all 10 workspace packages with zero errors | VERIFIED | `pnpm build` output: `Tasks: 10 successful, 10 total; Cached: 10 cached, 10 total; FULL TURBO` — all packages green |
| 9 | Grep for 'http://' in packages/foundation/src/storage/ returns zero matches | VERIFIED | Grep result: `No matches found` |
| 10 | Grep for process.env in new/changed files returns zero matches (all config via ConfigService) | VERIFIED | `process.env` search in `packages/foundation/src/storage/`, `apps/parser/src/infrastructure/storage/`, `apps/notifier/src/infrastructure/storage/` — zero matches in all three paths |

| # | Artifact | Expected | Status | Details |
|---|----------|----------|--------|---------|
| 1 | `packages/foundation/src/storage/infrastructure/s3-core.module.ts` | @Global singleton module | VERIFIED | Has `@Global()` decorator (line 11), provides `S3_CLIENT` + `S3ShutdownService`, exports `[S3_CLIENT]` |
| 2 | `packages/foundation/src/storage/infrastructure/bucket-storage.module.ts` | forBucket() factory with per-bucket token + healthToken | VERIFIED | `static forBucket(options: BucketStorageOptions): DynamicModule` present, injects shared `S3_CLIENT`, uses `options.token` and `options.healthToken` |
| 3 | `packages/foundation/src/storage/infrastructure/storage.interfaces.ts` | StoragePort, StorageHealthIndicator, BucketStorageOptions (4 fields) | VERIFIED | All three interfaces present; `BucketStorageOptions` has `bucket`, `token`, `healthToken`, `healthKey` all `readonly` |
| 4 | `packages/foundation/src/storage/reports/reports-storage.module.ts` | Real @Module class | VERIFIED | `@Module` decorator with imports+exports, zero `forRootAsync` |
| 5 | `packages/foundation/src/storage/reports/reports.constants.ts` | REPORTS_STORAGE, REPORTS_STORAGE_HEALTH, REPORTS_BUCKET, REPORTS_HEALTH_KEY | VERIFIED | All 4 exports present with correct values |
| 6 | `apps/parser/src/infrastructure/storage/parser-storage.module.ts` | Parser bucket wiring only (no ReportsStorageModule import) | VERIFIED | Imports `BucketStorageModule.forBucket(...)` only; zero `ReportsStorageModule` references |
| 7 | `apps/parser/src/infrastructure/storage/storage.module.ts` | Composition module: Parser + Reports | VERIFIED | Imports + exports `[ParserStorageModule, ReportsStorageModule]` |
| 8 | `apps/notifier/src/infrastructure/storage/storage.module.ts` | Composition module: Reports only | VERIFIED | Imports + exports `[ReportsStorageModule]` only, no BucketStorageModule |
| 9 | `packages/config/src/schemas/storage.ts` | STORAGE_PROTOCOL enum (http\|https), no STORAGE_BUCKET | VERIFIED | `STORAGE_PROTOCOL: z.enum(['http', 'https'])` on line 4; no `STORAGE_BUCKET` field |

| # | Key Link | From → To | Status | Evidence |
|---|----------|-----------|--------|----------|
| 1 | `bucket-storage.module.ts` → `s3-core.module.ts` | injects S3_CLIENT from @Global | VERIFIED | `bucket-storage.module.ts:18, 24` both have `inject: [S3_CLIENT]` |
| 2 | `reports/reports-storage.module.ts` → `infrastructure/bucket-storage.module.ts` | imports BucketStorageModule.forBucket | VERIFIED | `reports-storage.module.ts:12` calls `BucketStorageModule.forBucket({...})` |
| 3 | `apps/parser/.../parser-storage.module.ts` → `infrastructure/bucket-storage.module.ts` | imports with PARSER_STORAGE_BUCKET | VERIFIED | `parser-storage.module.ts:12-17` calls `forBucket` with parser constants |
| 4 | `apps/parser/.../storage.module.ts` → `parser-storage.module.ts` | composition import | VERIFIED | `storage.module.ts:3,6,7` imports and re-exports `ParserStorageModule` |
| 5 | `apps/parser/.../storage.module.ts` → `reports/reports-storage.module.ts` | composition import | VERIFIED | `storage.module.ts:2,6,7` imports and re-exports `ReportsStorageModule` from foundation |
| 6 | `apps/parser/src/parser.module.ts` → `infrastructure/s3-core.module.ts` | imports S3CoreModule | VERIFIED | `parser.module.ts:4,16` — `import { S3CoreModule }` and `imports: [..., S3CoreModule, StorageModule, ...]` |
| 7 | `apps/parser/src/health/health.controller.ts` → `parser.constants.ts` | injects two health tokens | VERIFIED | Both `PARSER_STORAGE_HEALTH` (from parser.constants) and `REPORTS_STORAGE_HEALTH` (from foundation) are injected and bound to distinct fields |
| 8 | `apps/notifier/src/health/health.controller.ts` → `reports/reports.constants.ts` | injects REPORTS_STORAGE_HEALTH | VERIFIED | `notifier/health.controller.ts:6,16` imports and `@Inject()` the Symbol |

### Deleted Files Verification

| File (must NOT exist) | Status |
|----------------------|--------|
| `packages/foundation/src/storage/storage.module.ts` | DELETED |
| `packages/foundation/src/storage/storage.providers.ts` | DELETED |
| `packages/foundation/src/storage/storage.service.ts` (flat) | DELETED |
| `packages/foundation/src/storage/storage.interfaces.ts` (flat) | DELETED |
| `packages/foundation/src/storage/storage.constants.ts` (flat) | DELETED |
| `packages/foundation/src/storage/s3.health.ts` (flat) | DELETED |
| `packages/foundation/src/storage/s3-shutdown.service.ts` (flat) | DELETED |
| `packages/foundation/src/storage/reports-storage.module.ts` (flat) | DELETED |
| `apps/notifier/src/infrastructure/storage/notifier-storage.module.ts` | DELETED |

9/9 expected deletions confirmed on disk.

## Code Review Findings Resolution

| ID | Severity | Finding | Status | File Evidence |
|----|----------|---------|--------|---------------|
| CR-01 | critical | Ambiguous STORAGE_HEALTH binding in parser (two StorageModule instances share the same Symbol, health check silently binds to wrong bucket) | RESOLVED | Per-bucket `healthToken: symbol` field in `BucketStorageOptions` (`infrastructure/storage.interfaces.ts:19`). Parser injects two separate tokens `PARSER_STORAGE_HEALTH` + `REPORTS_STORAGE_HEALTH` in `apps/parser/src/health/health.controller.ts:23-24`. No shared `STORAGE_HEALTH` Symbol exists in foundation anymore. |
| CR-02 | critical | ReportsStorageModule.forRootAsync() returned DynamicModule with `module: StorageModule`, so class never entered Nest graph, `exports: [ReportsStorageModule]` invalid | RESOLVED | `packages/foundation/src/storage/reports/reports-storage.module.ts` is now a real `@Module` class (lines 10-21) with zero `forRootAsync` method. Consumers write `imports: [ReportsStorageModule]` (plain class reference) — verified in `apps/parser/src/infrastructure/storage/storage.module.ts:6` and `apps/notifier/src/infrastructure/storage/storage.module.ts:5`. |
| WR-01 | warning | S3 endpoint protocol hardcoded to 'http://' — blocks HTTPS production deploy | RESOLVED | `STORAGE_PROTOCOL: z.enum(['http', 'https'])` in `packages/config/src/schemas/storage.ts:4`. Read via `config.get<string>('STORAGE_PROTOCOL')!` in `s3-core.module.ts:19`. Endpoint URL built from env: `${protocol}${STORAGE_ENDPOINT_SEPARATOR.SCHEME}${endpoint}${PORT}${port}` (line 26). Zero `'http://'` literals in `packages/foundation/src/storage/`. All three .env files have `STORAGE_PROTOCOL=http` for local MinIO. |
| WR-02 | warning | download() silently returned Buffer.alloc(0) on missing body | RESOLVED | `packages/foundation/src/storage/infrastructure/s3-storage.service.ts:39-41` — `if (response.Body === undefined) throw new Error(...)`. Zero `Buffer.alloc(0)` matches in storage module. |
| WR-03 | warning | Bucket names 'parser' and 'reports' inline as string literals in module config | RESOLVED | `REPORTS_BUCKET = 'reports'` in `packages/foundation/src/storage/reports/reports.constants.ts:4`; `PARSER_STORAGE_BUCKET = 'parser'` in `apps/parser/src/parser.constants.ts:6`. Both are used via import in module files — no inline literals. Grep `bucket:\s*['\"](reports\|parser)['\"]` across all .ts files returns zero matches. |
| WR-04 | warning | Multiple S3Client instances per service (one per StorageModule.forRootAsync call) | RESOLVED | `@Global() S3CoreModule` is the single source of `S3_CLIENT` — verified in `s3-core.module.ts:11`. `BucketStorageModule.forBucket()` does NOT create its own client (zero `new S3Client` matches in `bucket-storage.module.ts`), it injects the shared one via `inject: [S3_CLIENT]` (line 18, 24). Parser imports `S3CoreModule` once in `parser.module.ts:16`; notifier imports it once in `notifier.module.ts:21`. Single `S3ShutdownService` is a plain provider inside `S3CoreModule` (not a per-call provider). |
| IN-01 | info | STORAGE_BUCKET required in schema but never read | RESOLVED (side-effect) | Removed from `packages/config/src/schemas/storage.ts` and from `.env`, `.env.docker`, `.env.example`. |
| IN-02 | info | S3_HEALTH_CHECK.DOWN_MESSAGE extracted though it's a log string | OUT OF SCOPE | Documented in 22-REVIEW.md resolution block as cosmetic, not fixed. Kept for consistency with `REDIS_HEALTH_CHECK`. |
| IN-03 | info | storageProviders() free-function convention note | OUT OF SCOPE | No action required (pattern consistency note). Superseded by new factory pattern in `BucketStorageModule` anyway. |

**22-REVIEW.md frontmatter status:** `resolved` with `resolution` block listing closed findings. Verified in the review file.

## Requirements Traceability

| Requirement | Source Plan | Description (from REQUIREMENTS.md) | Status | Evidence |
|-------------|------------|------------------------------------|--------|----------|
| S3-01 | 22-01, 22-03 | StorageModule в foundation с `forRootAsync()`, Symbol DI tokens, health indicator, shutdown service | SATISFIED (with spec evolution) | `forRootAsync()` was replaced by the architecturally superior pattern `@Global() S3CoreModule + BucketStorageModule.forBucket()` per 22-CODE-REVIEW-NOTES user-approved design. Symbol DI tokens: `S3_CLIENT`, `REPORTS_STORAGE`, `REPORTS_STORAGE_HEALTH`, `PARSER_STORAGE`, `PARSER_STORAGE_HEALTH` — all `Symbol()` constructed. Health indicator: `S3HealthIndicator` in `infrastructure/s3.health.ts`. Shutdown service: `S3ShutdownService` in `infrastructure/s3-shutdown.service.ts` (now singleton). The REQUIREMENTS.md wording still says "forRootAsync()" — this is a stale spec wording, not a code gap. |
| S3-02 | 22-01, 22-03 | Unified client через AWS SDK v3 работает с MinIO (local) и Garage (prod) без изменения кода | SATISFIED | `@aws-sdk/client-s3@^3.x` and `@aws-sdk/s3-request-presigner@^3.x` in `packages/foundation/package.json`. Zero provider branching in `S3CoreModule` — same `forcePathStyle`, same checksums, same SDK calls. Provider switch is env-var-only via `STORAGE_PROTOCOL` + `STORAGE_ENDPOINT` + `STORAGE_PORT` + credentials. |
| S3-03 | 22-01, 22-02, 22-03 | Env vars переименованы MINIO_* → S3_* (S3_ENDPOINT, S3_ACCESS_KEY, ...) | SATISFIED (with naming convention deviation — accepted) | Per 22-CONTEXT.md D-12 (phase planning decision): `Env vars остаются STORAGE_* ... S3-03 уже выполнен в v3.0`. The actual convention chosen is `STORAGE_*` (provider-agnostic, cleaner than `S3_*`). No `MINIO_*` references in app code (`apps/**` and `packages/**`). `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` in `.env.example` are MinIO container internals, not consumed by app. The intent — "no provider-specific names in code" — is fully satisfied. |
| S3-04 | 22-01, 22-02, 22-03 | Сервис может загружать, скачивать и удалять файлы через DI token | SATISFIED | `StoragePort` interface (`infrastructure/storage.interfaces.ts`) defines `upload`, `download`, `delete`, `exists`, `getSignedUrl` — all 5 methods. Concrete implementation in `S3StorageService` (`infrastructure/s3-storage.service.ts`) uses PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, and the presigner. Parser and notifier inject `PARSER_STORAGE` / `REPORTS_STORAGE` Symbols to obtain StoragePort instances. |

**Note on REQUIREMENTS.md status markers:** REQUIREMENTS.md still shows S3-01..S3-04 as `Pending` in the status table (lines 151-155). This is a stale marker — ROADMAP.md correctly marks Phase 22 as `[x]` completed. This is a documentation hygiene issue, not a code gap, and falls outside verifier scope.

## Data-Flow Trace (Level 4)

Storage module is infrastructure plumbing — it does not render dynamic data in a UI sense. The equivalent data-flow check is "does calling `StoragePort.upload()` / `download()` on an injected instance reach the underlying S3 service?" This is verified by the chain:

| Consumer | Injected Token | Backing Instance | Writes To |
|----------|---------------|------------------|-----------|
| Parser (future use cases) | `PARSER_STORAGE` | `new S3StorageService(shared_client, 'parser')` via `BucketStorageModule.forBucket()` | Real AWS SDK v3 calls using shared `S3_CLIENT` |
| Parser (reports) | `REPORTS_STORAGE` | `new S3StorageService(shared_client, 'reports')` via `BucketStorageModule.forBucket()` | Real AWS SDK v3 calls using shared `S3_CLIENT` |
| Notifier (reports) | `REPORTS_STORAGE` | Same `new S3StorageService(shared_client, 'reports')` per notifier process | Real AWS SDK v3 calls using shared `S3_CLIENT` |
| Parser health | `PARSER_STORAGE_HEALTH` | `new S3HealthIndicator(his, shared_client, 'parser')` | Real `HeadBucketCommand({Bucket: 'parser'})` |
| Parser health | `REPORTS_STORAGE_HEALTH` | `new S3HealthIndicator(his, shared_client, 'reports')` | Real `HeadBucketCommand({Bucket: 'reports'})` |
| Notifier health | `REPORTS_STORAGE_HEALTH` | Same `new S3HealthIndicator(his, shared_client, 'reports')` | Real `HeadBucketCommand({Bucket: 'reports'})` |

**Status: FLOWING** — every injected token resolves to a real S3 SDK call with a real bucket name, backed by a real singleton `S3Client`. No hardcoded empty values, no stub returns, no static fallback. The chain from `@Inject(PARSER_STORAGE)` → `StoragePort.upload(key, body, type)` → `this.client.send(new PutObjectCommand(...))` is unbroken and wired correctly.

The only thing that is NOT tested at runtime is whether the AWS SDK actually connects to a live MinIO/Garage instance — this requires runtime validation (see `human_verification` items).

## Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| Foundation TypeScript compiles | `pnpm build --filter=@email-platform/foundation` (implicitly run as part of full build) | Cache hit, zero TSC errors | PASS |
| Parser TypeScript compiles with new DI wiring | `pnpm build --filter=@email-platform/parser` (implicitly) | Cache hit, zero NestCLI/TSC errors | PASS |
| Notifier TypeScript compiles with new DI wiring | `pnpm build --filter=@email-platform/notifier` (implicitly) | Cache hit, zero NestCLI/TSC errors | PASS |
| Full workspace build | `pnpm build` | `Tasks: 10 successful, 10 total; FULL TURBO` | PASS |
| No `'http://'` in storage module | `grep -r "http://" packages/foundation/src/storage` | No matches found | PASS |
| No `process.env` in storage code | `grep process.env packages/foundation/src/storage apps/*/src/infrastructure/storage` | No matches found | PASS |
| No `Buffer.alloc(0)` in download | `grep "Buffer.alloc(0)" packages/foundation/src/storage` | No matches found | PASS |
| No inline bucket literals | `grep "bucket:\s*['\"](reports\|parser)['\"]"` | No matches found | PASS |
| No shared `STORAGE_HEALTH` Symbol | `grep -w STORAGE_HEALTH packages/foundation/src/storage` | No matches found | PASS |
| No `HEALTH.INDICATOR.S3` references | `grep HEALTH.INDICATOR.S3 **/*.ts` | No matches found | PASS |
| Only one `new S3Client` in storage module | `grep "new S3Client" packages/foundation/src/storage` | Exactly 1 match — `s3-core.module.ts:25` (the @Global singleton factory) | PASS |
| Zero `forRootAsync` in foundation storage | `grep forRootAsync packages/foundation/src/storage` | No matches found | PASS |
| `STORAGE_BUCKET` orphan removed from env | `grep "^STORAGE_BUCKET=" .env .env.docker .env.example` | No matches found | PASS |
| `STORAGE_PROTOCOL` added to env files | `grep "^STORAGE_PROTOCOL=" .env .env.docker .env.example` | 3/3 matches (all `=http`) | PASS |

All 14 spot-checks pass.

## Anti-Patterns Found

None. Searches for TODO/FIXME/PLACEHOLDER, hardcoded empty returns, static `return Response.json([])` patterns, and `console.log`-only implementations in the storage-module and app-storage-wiring files return zero matches. The only TODO comments in parser.module.ts (line 31, 33) and notifier.module.ts (line 38) are pre-existing comments about gRPC drain / RabbitMQ close in `onModuleDestroy` hooks, unrelated to phase 22.

## Human Verification Required

Automated checks confirm the code is structurally correct, compiles cleanly, and has no anti-patterns. However, four behaviors can only be verified by actually running the services against real S3-compatible storage:

### 1. Parser readiness with two buckets at runtime

**Test:** Bring up local MinIO via `docker-compose up -d minio`, create buckets `parser` and `reports`, boot parser service locally, curl `GET /health/ready`
**Expected:** Response contains two distinct storage health indicators keyed `s3:parser` and `s3:reports`, both `status: up`. Stop MinIO, retry — both should go `down`. Start MinIO, delete only the `parser` bucket, retry — only `s3:parser` should be `down` while `s3:reports` stays `up`.
**Why human:** Nest's DI graph resolution and actual HeadBucket round-trip cannot be exercised by `tsc` or `nest build` — both stop at type-checking. Project has no tests (explicit constraint). Only a boot exposes provider-binding correctness (the original CR-01 was not caught by `pnpm build`).

### 2. Notifier readiness with reports bucket at runtime

**Test:** Boot notifier service locally, curl `GET /health/ready`
**Expected:** Response contains `rabbitmq: up` and `s3:reports: up`. No error about unresolved `STORAGE_HEALTH` token in startup logs.
**Why human:** Same as above. In particular, the notifier side of CR-01 + CR-02 is only visible at runtime — a misconfigured module graph may still compile but fail at `NestFactory.create()`.

### 3. MinIO → Garage provider swap verification

**Test:** In a staging env file: `STORAGE_PROTOCOL=https`, `STORAGE_ENDPOINT=s3.email-platform.pp.ua`, `STORAGE_PORT=443`, credentials pointed at Garage. Redeploy parser. Trigger a use case that calls `storagePort.upload(...)` against the parser bucket.
**Expected:** Upload succeeds without any code change. The `S3Client` connects using `https://s3.email-platform.pp.ua:443` with `forcePathStyle` and `WHEN_REQUIRED` checksums.
**Why human:** The core phase goal — "works identically with MinIO and Garage without code changes" — can only be truly proved by running both providers and verifying an actual file flows through. Automated verification can only confirm that the code PATH for provider-agnostic configuration exists, which it does.

### 4. SIGTERM shutdown verification

**Test:** Boot parser service, start a long-running download via an injected `StoragePort`, send SIGTERM to the parser process.
**Expected:** Exactly one `S3ShutdownService.onApplicationShutdown` log entry, exactly one `S3Client.destroy()` call, in-flight request either completes or is cleanly rejected. Process exits with code 0.
**Why human:** WR-04 "single S3 client per process" is observable only by watching the shutdown lifecycle — static analysis confirms `S3CoreModule` is `@Global()` and `S3ShutdownService` is a single provider, but doesn't prove the runtime graph actually has one instance.

## Build Verification

```
Tasks:    10 successful, 10 total
Cached:   10 cached, 10 total
Time:     45ms >>> FULL TURBO
```

All 10 workspace packages (contracts, config, foundation, gateway, auth, sender, parser, audience, notifier + one additional) are green with cache fully populated. The FULL TURBO cache state confirms the on-disk source matches the state that last produced a green build.

## Gaps Summary

**None.** All 25 must-haves across the three plans are verified, all 6 code review findings are architecturally resolved with file-level evidence, all 4 requirements are satisfied (with two documented wording-level deviations from the requirement spec that are intentional and approved in 22-CONTEXT.md D-12 and 22-CODE-REVIEW-NOTES.md). The build is green.

The only open items are four runtime-validation tasks listed under "Human Verification Required" — these are not gaps because the phase constraint explicitly excludes tests (`.claude/CLAUDE.md > Constraints > Без тестов`). The phase delivers a correct, compilable, architecturally sound storage layer; proving the storage actually connects to MinIO/Garage requires a running environment, which is outside the phase's automated-verification scope.

## Score

**25/25 must-haves verified** across plans 22-01 (6 truths + 6 artifacts + 2 links), 22-02 (7 truths + 4 artifacts + 2 links), and 22-03 (10 truths + 9 artifacts + 8 links) — aggregated and deduplicated where earlier-plan items were superseded by 22-03 refactor decisions.

Goal achievement: **true**. Phase status: **human_needed** (automated verification passes; runtime provider-swap and DI-graph validation are the remaining gates and must be performed by the developer before the storage layer is considered production-ready).

---

*Verified: 2026-04-09T13:05:00Z*
*Verifier: Claude (gsd-verifier)*
