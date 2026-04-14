---
phase: "22"
plan: "22-03"
plan_id: "22-03"
subsystem: storage
gap_closure: true
tags: [s3, storage, refactor, code-review, foundation, parser, notifier]
findings_resolved: [CR-01, CR-02, WR-01, WR-02, WR-03, WR-04]
dependency-graph:
  requires: ["22-01", "22-02"]
  provides:
    - S3CoreModule (global singleton S3Client + S3ShutdownService per process)
    - BucketStorageModule.forBucket (per-bucket factory with per-bucket health tokens)
    - ReportsStorageModule (real @Module class in Nest graph)
    - STORAGE_PROTOCOL env var (enum http|https)
    - Per-bucket named constants (PARSER_STORAGE_BUCKET, PARSER_STORAGE_HEALTH_KEY, REPORTS_BUCKET, REPORTS_HEALTH_KEY)
  affects:
    - apps/parser (new composition StorageModule, two-bucket health check)
    - apps/notifier (composition-only StorageModule, REPORTS_STORAGE_HEALTH)
tech-stack:
  added: []
  patterns:
    - "@Global() singleton module providing shared DI token (mirrors DrizzleModule/PG_POOL)"
    - "Factory DynamicModule with per-call Symbol tokens (replaces single shared Symbol)"
    - "Composition @Module re-exporting multiple per-bucket modules"
key-files:
  created:
    - packages/foundation/src/storage/infrastructure/s3-core.module.ts
    - packages/foundation/src/storage/infrastructure/bucket-storage.module.ts
    - packages/foundation/src/storage/infrastructure/s3-storage.service.ts
    - packages/foundation/src/storage/infrastructure/s3.health.ts
    - packages/foundation/src/storage/infrastructure/s3-shutdown.service.ts
    - packages/foundation/src/storage/infrastructure/storage.interfaces.ts
    - packages/foundation/src/storage/infrastructure/storage.constants.ts
    - packages/foundation/src/storage/infrastructure/index.ts
    - packages/foundation/src/storage/reports/reports-storage.module.ts
    - packages/foundation/src/storage/reports/reports.constants.ts
    - packages/foundation/src/storage/reports/index.ts
    - apps/parser/src/infrastructure/storage/storage.module.ts
    - apps/notifier/src/infrastructure/storage/storage.module.ts
  modified:
    - packages/config/src/schemas/storage.ts
    - packages/foundation/src/storage/index.ts
    - packages/foundation/src/health/health-constants.ts
    - apps/parser/src/parser.constants.ts
    - apps/parser/src/infrastructure/storage/parser-storage.module.ts
    - apps/parser/src/infrastructure/storage/index.ts
    - apps/parser/src/parser.module.ts
    - apps/parser/src/health/health.controller.ts
    - apps/notifier/src/infrastructure/storage/index.ts
    - apps/notifier/src/notifier.module.ts
    - apps/notifier/src/health/health.controller.ts
    - .env
    - .env.docker
    - .env.example
    - .planning/phases/22-s3-storagemodule/22-REVIEW.md
    - .planning/phases/22-s3-storagemodule/22-01-SUMMARY.md
    - .planning/phases/22-s3-storagemodule/22-02-SUMMARY.md
  deleted:
    - packages/foundation/src/storage/storage.module.ts
    - packages/foundation/src/storage/storage.providers.ts
    - packages/foundation/src/storage/storage.service.ts
    - packages/foundation/src/storage/storage.interfaces.ts
    - packages/foundation/src/storage/storage.constants.ts
    - packages/foundation/src/storage/s3.health.ts
    - packages/foundation/src/storage/s3-shutdown.service.ts
    - packages/foundation/src/storage/reports-storage.module.ts
    - apps/notifier/src/infrastructure/storage/notifier-storage.module.ts
decisions:
  - "Split storage/ into infrastructure/ (primitives) + reports/ (concrete shared bucket) for separation of plumbing vs per-bucket configuration"
  - "Use @Global() S3CoreModule for singleton S3Client instead of per-bucket client creation (mirrors DrizzleModule/PG_POOL)"
  - "Per-bucket healthToken Symbol in BucketStorageOptions to prevent CR-01 collision"
  - "ReportsStorageModule rewritten as real @Module (not .forRootAsync alias) to enter Nest graph correctly"
  - "STORAGE_PROTOCOL as required z.enum(['http', 'https']) — no default, no optional per env-schema skill"
  - "Bucket names and health keys as named constants colocated with each bucket's module"
  - "Parser health controller injects two separate tokens (PARSER_STORAGE_HEALTH + REPORTS_STORAGE_HEALTH) for independent bucket monitoring"
metrics:
  duration: "8m 54s"
  completed: 2026-04-09
  tasks: 11
  commits: 11
---

# Phase 22 Plan 03: Code Review Fix Refactor Summary

**One-liner:** Архитектурный рефакторинг storage модуля закрывающий 6 находок code review — разделение на `infrastructure/` (S3CoreModule singleton + BucketStorageModule factory) и `reports/` (real @Module ReportsStorageModule) с per-bucket health tokens, STORAGE_PROTOCOL env var и WR-02 download() throw-on-empty.

## What Was Built

Plan 22-03 — это gap-closure refactor плана, закрывающий 6 из 9 находок code review (`22-REVIEW.md`) единым архитектурным изменением согласованной с пользователем архитектуры (`22-CODE-REVIEW-NOTES.md`). Не greenfield-работа — это рефакторинг уже существующего storage модуля из Waves 22-01 и 22-02.

### Foundation — новая двухслойная структура

`packages/foundation/src/storage/` теперь разделён на два слоя:

```
packages/foundation/src/storage/
├── infrastructure/              # generic primitives — работают с любым bucket
│   ├── s3-core.module.ts            @Global S3Client singleton
│   ├── bucket-storage.module.ts     BucketStorageModule.forBucket() factory
│   ├── s3-storage.service.ts        S3StorageService (+ WR-02 throw fix)
│   ├── s3.health.ts                 S3HealthIndicator
│   ├── s3-shutdown.service.ts       S3ShutdownService
│   ├── storage.interfaces.ts        StoragePort, StorageHealthIndicator, BucketStorageOptions
│   ├── storage.constants.ts         S3_CLIENT, S3_DEFAULTS, STORAGE_ENDPOINT_SEPARATOR, ...
│   └── index.ts
│
├── reports/                     # concrete shared bucket — "implementation" layer
│   ├── reports-storage.module.ts    ReportsStorageModule (real @Module)
│   ├── reports.constants.ts         REPORTS_STORAGE, REPORTS_STORAGE_HEALTH, REPORTS_BUCKET, REPORTS_HEALTH_KEY
│   └── index.ts
│
└── index.ts                     # top-level barrel — re-exports both layers
```

Принцип разделения: `infrastructure/` — примитивы, знают S3, не знают конкретных buckets. `reports/` — конкретная конфигурация одного shared bucket, использующая эти примитивы. Будущие shared buckets (`logs/`, `archives/`, ...) получат собственные sibling-папки по тому же паттерну.

### Ключевые архитектурные решения

**S3CoreModule (@Global singleton) — WR-04 fix:**
```typescript
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: S3_CLIENT,
      inject: [ConfigService],
      useFactory: (config) => new S3Client({
        endpoint: `${protocol}${SCHEME}${endpoint}${PORT}${port}`,
        // ...
      }),
    },
    S3ShutdownService,
  ],
  exports: [S3_CLIENT],
})
export class S3CoreModule {}
```

Один `S3Client` + один `S3ShutdownService` на процесс сервиса. Mirrors `DrizzleModule`/`PG_POOL` pattern. Parser больше не создаёт два client pools (для parser bucket и reports bucket).

**BucketStorageModule.forBucket() — CR-01 fix:**
```typescript
static forBucket(options: BucketStorageOptions): DynamicModule {
  return {
    imports: [TerminusModule],
    providers: [
      { provide: options.token,       inject: [S3_CLIENT], useFactory: ... },
      { provide: options.healthToken, inject: [HealthIndicatorService, S3_CLIENT], useFactory: ... },
    ],
    exports: [TerminusModule, options.token, options.healthToken],
  };
}
```

Инжектит shared `S3_CLIENT` (не создаёт свой). Per-bucket `healthToken` — каждый bucket получает свой Symbol → больше нет collision при двух bucket instances в одном сервисе.

**ReportsStorageModule — CR-02 fix:**
```typescript
@Module({
  imports: [
    BucketStorageModule.forBucket({
      bucket:      REPORTS_BUCKET,
      token:       REPORTS_STORAGE,
      healthToken: REPORTS_STORAGE_HEALTH,
      healthKey:   REPORTS_HEALTH_KEY,
    }),
  ],
  exports: [REPORTS_STORAGE, REPORTS_STORAGE_HEALTH],
})
export class ReportsStorageModule {}
```

Реальный `@Module` класс, который входит в Nest module graph. Не `.forRootAsync()` alias который возвращал `DynamicModule` с `module: StorageModule`. Consumers пишут `imports: [ReportsStorageModule]` — никаких factory calls.

**S3StorageService.download() — WR-02 fix:**
```typescript
if (response.Body === undefined) {
  throw new Error(`S3 object has empty body: bucket=${this.bucket} key=${key}`);
}
```

Больше нет silent `Buffer.alloc(0)` fallback — бросаем явную ошибку.

### Env schema — WR-01 fix (user-approved)

- Добавлен `STORAGE_PROTOCOL: z.enum(['http', 'https'])` в `StorageSchema` (required, no default)
- Удалён orphan `STORAGE_BUCKET: z.string().min(1)` (никогда не читался кодом — side-effect closes IN-01)
- `STORAGE_PROTOCOL=http` добавлен в `.env`, `.env.docker`, `.env.example`
- `STORAGE_BUCKET=...` удалён из всех трёх .env файлов

URL endpoint теперь собирается из `${protocol}${SCHEME}${endpoint}${PORT}${port}` через `STORAGE_ENDPOINT_SEPARATOR` константы — нет hardcoded `'http://'`.

### Named bucket constants — WR-03 fix

**Foundation (reports/reports.constants.ts):**
```typescript
export const REPORTS_BUCKET     = 'reports';
export const REPORTS_HEALTH_KEY = 's3:reports';
```

**Parser app (parser.constants.ts):**
```typescript
export const PARSER_STORAGE_BUCKET     = 'parser';
export const PARSER_STORAGE_HEALTH_KEY = 's3:parser';
```

Ни одного inline bucket literal в module файлах — всё через константы.

### Parser app — новая структура

`apps/parser/src/infrastructure/storage/` теперь два файла:
- `parser-storage.module.ts` — только parser bucket (симметрично foundation's `reports-storage.module.ts`)
- `storage.module.ts` — composition `ParserStorageModule + ReportsStorageModule`

Parser root module импортирует `S3CoreModule` (global singleton) и local composition `StorageModule`. Parser health controller теперь инжектит **два отдельных health token'а** (`PARSER_STORAGE_HEALTH` + `REPORTS_STORAGE_HEALTH`) и проверяет оба bucket'а в `readiness()`. Parser bucket outage теперь видим — CR-01 закрыт полностью.

### Notifier app — composition-only

`apps/notifier/src/infrastructure/storage/notifier-storage.module.ts` удалён (notifier не имеет собственного bucket'а). Новый `storage.module.ts` — composition-only с единственным импортом `ReportsStorageModule`. Notifier health controller инжектит `REPORTS_STORAGE_HEALTH` с `REPORTS_HEALTH_KEY` константой.

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | `20e1df0` | `refactor(22-03): add STORAGE_PROTOCOL env var, remove orphan STORAGE_BUCKET` |
| 2 | `705afcf` | `refactor(22-03): create storage/infrastructure folder with primitives and WR-02 download fix` |
| 3 | `7dd3c39` | `feat(22-03): add S3CoreModule global singleton` |
| 4 | `0dfdab4` | `feat(22-03): add BucketStorageModule factory with per-bucket health tokens` |
| 5 | `cc49a43` | `refactor(22-03): isolate reports bucket in storage/reports folder with real @Module class` |
| 6 | `49bfe43` | `refactor(22-03): flip storage barrel to infrastructure+reports, delete old flat files, remove HEALTH.INDICATOR.S3` |
| 7 | `f5f76b0` | `refactor(22-03): split parser storage into ParserStorageModule and StorageModule composition` |
| 8 | `0215a2e` | `fix(22-03): wire parser root module and health controller to per-bucket storage tokens` |
| 9 | `e24cc3f` | `refactor(22-03): collapse notifier storage to composition-only StorageModule` |
| 10 | `5054578` | `fix(22-03): wire notifier root module and health controller to REPORTS_STORAGE_HEALTH` |
| 11 | `9cd59e1` | `docs(22-03): mark review findings resolved and add fix-reference notes to wave summaries` |

## Findings Resolved

| Finding | Severity | Root cause | Fix |
|---------|----------|------------|-----|
| CR-01 | critical | `STORAGE_HEALTH` Symbol collision при двух StorageModule в parser | Per-bucket `healthToken` в `BucketStorageOptions`; parser инжектит `PARSER_STORAGE_HEALTH` и `REPORTS_STORAGE_HEALTH` раздельно |
| CR-02 | critical | `ReportsStorageModule.forRootAsync()` возвращал DynamicModule с `module: StorageModule` — сам класс не попадал в граф | Переписан как real `@Module` с `imports: [BucketStorageModule.forBucket(...)]` |
| WR-01 | warning | `http://` hardcoded в `S3_ENDPOINT.PROTOCOL` константе | Новый required env var `STORAGE_PROTOCOL` (enum `http\|https`); URL собирается из env |
| WR-02 | warning | `download()` silently возвращал `Buffer.alloc(0)` при пустом body | Бросаем `Error` вместо тихого fallback |
| WR-03 | warning | Magic bucket literals `'parser'` и `'reports'` inline в модулях | Вынесены в `PARSER_STORAGE_BUCKET` и `REPORTS_BUCKET` константы |
| WR-04 | warning | Каждый `StorageModule.forRootAsync()` создавал свой `S3Client` + `S3ShutdownService` | `@Global() S3CoreModule` — один `S3_CLIENT` + один `S3ShutdownService` на процесс |
| IN-01 | info | Orphan `STORAGE_BUCKET` env var никогда не читался | Закрыт как side-effect удаления из schema/.env |

**IN-02 и IN-03 — out of scope** (cosmetic log string, convention note).

## Deviations from Plan

None — plan executed exactly as written. All 11 tasks ran in strict sequence, no architectural changes, no scope creep, no authentication gates. Intermediate build state at Task 6 (foundation green, apps broken) was expected and documented in the plan; Task 10 restored full workspace green.

## Verification

**Structural verification (all PASS):**
- `packages/foundation/src/storage/infrastructure/` содержит: s3-core.module.ts, bucket-storage.module.ts, s3-storage.service.ts, s3.health.ts, s3-shutdown.service.ts, storage.interfaces.ts, storage.constants.ts, index.ts (8 файлов)
- `packages/foundation/src/storage/reports/` содержит: reports-storage.module.ts, reports.constants.ts, index.ts (3 файла)
- `packages/foundation/src/storage/` top-level: только index.ts + 2 subfolders (чистый barrel)
- Все 8 старых flat файлов удалены (`storage.module.ts`, `storage.providers.ts`, `storage.service.ts`, `storage.interfaces.ts`, `storage.constants.ts`, `s3.health.ts`, `s3-shutdown.service.ts`, `reports-storage.module.ts`)
- `apps/notifier/src/infrastructure/storage/notifier-storage.module.ts` — удалён
- `apps/parser/src/infrastructure/storage/storage.module.ts` — создан
- `apps/notifier/src/infrastructure/storage/storage.module.ts` — создан

**Build verification (PASS):**
- `pnpm build` — 10/10 workspace packages green, all cached after final task

**Grep verification (all PASS):**
- `'http://'` в `packages/foundation/src/storage/` — zero matches
- `process.env` в `packages/foundation/src/storage/`, `apps/parser/src/infrastructure/storage/`, `apps/notifier/src/infrastructure/storage/` — zero matches
- `'parser'` inline в `apps/parser/src/infrastructure/storage/` — zero matches (только константа в parser.constants.ts)
- `'reports'` inline в `packages/foundation/src/storage/` — только константа в reports.constants.ts
- `.default(`, `.optional(`, `z.coerce.boolean` в `packages/config/src/schemas/storage.ts` — zero matches (env-schema skill)

**Finding-by-finding verification (all PASS):**

| Finding | Check | Result |
|---------|-------|--------|
| CR-01 | Parser health controller injects 2 different health Symbols | PASS — `PARSER_STORAGE_HEALTH` + `REPORTS_STORAGE_HEALTH` |
| CR-02 | `ReportsStorageModule` — real `@Module` class | PASS — `@Module({imports: [BucketStorageModule.forBucket(...)]})` |
| CR-02 | No `forRootAsync` on `ReportsStorageModule` | PASS — zero matches |
| WR-01 | `STORAGE_PROTOCOL` в schema + 3 .env файлах | PASS — 4 matches |
| WR-02 | `download()` throws on empty body | PASS — `throw new Error` найден в s3-storage.service.ts |
| WR-02 | No `Buffer.alloc(0)` fallback | PASS — zero matches |
| WR-03 | Named bucket constants existing | PASS — `REPORTS_BUCKET`, `PARSER_STORAGE_BUCKET` |
| WR-04 | `S3CoreModule` is `@Global()` | PASS |
| WR-04 | `BucketStorageModule` НЕ создаёт свой `S3Client` | PASS — `new S3Client` zero matches in bucket-storage.module.ts |

**Documentation verification (PASS):**
- `22-REVIEW.md` frontmatter: `status: resolved` + resolution block
- `22-01-SUMMARY.md` содержит "Post-Review Fix Reference — Plan 22-03" секцию
- `22-02-SUMMARY.md` содержит "Post-Review Fix Reference — Plan 22-03" секцию

## Success Criteria

Все 25 критериев успеха из `<success_criteria>` блока плана выполнены:

- [x] `22-REVIEW.md` findings CR-01, CR-02, WR-01, WR-02, WR-03, WR-04 marked `resolved`
- [x] `packages/foundation/src/storage/infrastructure/` directory exists with all primitive files
- [x] `packages/foundation/src/storage/reports/` directory exists with `ReportsStorageModule` + 2 companion files
- [x] `packages/foundation/src/storage/storage.module.ts` NOT exists
- [x] `packages/foundation/src/storage/storage.providers.ts` NOT exists
- [x] `packages/foundation/src/storage/reports-storage.module.ts` (flat) NOT exists
- [x] `S3CoreModule` exists as `@Global()` provides `S3_CLIENT` + `S3ShutdownService`
- [x] `BucketStorageModule.forBucket()` injects `S3_CLIENT` (NOT creates own)
- [x] `ReportsStorageModule` is real `@Module` class
- [x] Zero `'http://'` в `packages/foundation/src/storage/`
- [x] `STORAGE_PROTOCOL` в schema + 3 .env files
- [x] `STORAGE_BUCKET` NOT in schema + 3 .env files
- [x] Parser `parser-storage.module.ts` contains ONLY parser bucket wiring
- [x] Parser `storage.module.ts` composition exists
- [x] Notifier `storage.module.ts` imports only `ReportsStorageModule`
- [x] Notifier `notifier-storage.module.ts` NOT exists
- [x] Parser `health.controller.ts` injects TWO tokens
- [x] Notifier `health.controller.ts` injects `REPORTS_STORAGE_HEALTH`
- [x] `HEALTH.INDICATOR.S3` removed
- [x] `STORAGE_HEALTH` Symbol removed from foundation exports
- [x] `pnpm build` — 10/10 green
- [x] Zero `process.env` in new/changed foundation+app files
- [x] Zero inline bucket literals `'parser'`/`'reports'`
- [x] `S3StorageService.download()` throws on undefined body (no `Buffer.alloc(0)`)

## Known Stubs

None. No stub patterns introduced — all providers are real factories, no hardcoded empty values flowing to health checks or storage operations, no placeholder strings.

## Threat Flags

None. This refactor does NOT introduce new attack surface. All Wave 1/2 threat model items (T-22-01 through T-22-06) remain in effect. Plan 22-03 mitigations (T-22-07 orphan env var removed, T-22-08 parser health signal correctness restored) are documented in `22-03-PLAN.md` `<threat_model>` block.

## Self-Check: PASSED

**Files verified on disk:**
- FOUND: packages/foundation/src/storage/infrastructure/s3-core.module.ts
- FOUND: packages/foundation/src/storage/infrastructure/bucket-storage.module.ts
- FOUND: packages/foundation/src/storage/infrastructure/s3-storage.service.ts
- FOUND: packages/foundation/src/storage/infrastructure/s3.health.ts
- FOUND: packages/foundation/src/storage/infrastructure/s3-shutdown.service.ts
- FOUND: packages/foundation/src/storage/infrastructure/storage.interfaces.ts
- FOUND: packages/foundation/src/storage/infrastructure/storage.constants.ts
- FOUND: packages/foundation/src/storage/infrastructure/index.ts
- FOUND: packages/foundation/src/storage/reports/reports-storage.module.ts
- FOUND: packages/foundation/src/storage/reports/reports.constants.ts
- FOUND: packages/foundation/src/storage/reports/index.ts
- FOUND: packages/foundation/src/storage/index.ts (re-exports infrastructure + reports)
- FOUND: apps/parser/src/infrastructure/storage/parser-storage.module.ts (rewritten)
- FOUND: apps/parser/src/infrastructure/storage/storage.module.ts (new)
- FOUND: apps/parser/src/infrastructure/storage/index.ts (modified)
- FOUND: apps/notifier/src/infrastructure/storage/storage.module.ts (new)
- FOUND: apps/notifier/src/infrastructure/storage/index.ts (modified)

**Files verified DELETED:**
- GONE: packages/foundation/src/storage/storage.module.ts
- GONE: packages/foundation/src/storage/storage.providers.ts
- GONE: packages/foundation/src/storage/storage.service.ts
- GONE: packages/foundation/src/storage/storage.interfaces.ts
- GONE: packages/foundation/src/storage/storage.constants.ts
- GONE: packages/foundation/src/storage/s3.health.ts
- GONE: packages/foundation/src/storage/s3-shutdown.service.ts
- GONE: packages/foundation/src/storage/reports-storage.module.ts
- GONE: apps/notifier/src/infrastructure/storage/notifier-storage.module.ts

**Commits verified in git log:**
- FOUND: 20e1df0 (Task 1: STORAGE_PROTOCOL env var)
- FOUND: 705afcf (Task 2: infrastructure folder + WR-02 fix)
- FOUND: 7dd3c39 (Task 3: S3CoreModule global singleton)
- FOUND: 0dfdab4 (Task 4: BucketStorageModule factory)
- FOUND: cc49a43 (Task 5: reports folder with real @Module)
- FOUND: 49bfe43 (Task 6: flip barrel, delete old files, remove HEALTH.INDICATOR.S3)
- FOUND: f5f76b0 (Task 7: parser storage split)
- FOUND: 0215a2e (Task 8: parser health controller + root module wiring)
- FOUND: e24cc3f (Task 9: notifier composition storage)
- FOUND: 5054578 (Task 10: notifier root module + health controller wiring)
- FOUND: 9cd59e1 (Task 11: docs update)

**Build verified:**
- Full workspace: `pnpm build` — 10 successful, 10 total (cache FULL TURBO at final verification)

**Acceptance criteria (Tasks 1-11):** 11/11 tasks PASS
**Plan verification block:** all checks PASS
**Success criteria block:** 25/25 PASS

---

*Phase: 22-s3-storagemodule*
*Plan: 22-03 (code review fixes)*
*Completed: 2026-04-09*
*Duration: 8m 54s*
