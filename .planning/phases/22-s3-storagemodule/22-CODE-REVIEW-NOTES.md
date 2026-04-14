---
phase: 22-s3-storagemodule
purpose: Architectural context for plan 22-03 (code review fixes). Consumed by gsd-planner.
source: 22-REVIEW.md + conversation decisions
created: 2026-04-09
status: approved-by-user
---

# Phase 22 — Code Review Fix Architecture

This document captures the architectural decisions agreed with the user during post-review discussion. It is the authoritative input for `gsd-planner` when creating `22-03-PLAN.md` (code review fix plan).

## Scope

Close 6 of 9 findings from `22-REVIEW.md` through a unified architectural refactor:

| Finding | Severity | Root cause | Where fixed |
|---------|----------|------------|-------------|
| CR-01 | critical | `STORAGE_HEALTH` Symbol collision when one service imports two `StorageModule` instances (parser + reports) | Per-bucket `healthToken` in `BucketStorageOptions`; caller passes unique Symbol per bucket |
| CR-02 | critical | `ReportsStorageModule.forRootAsync()` returns a `DynamicModule` with `module: StorageModule` — the class never enters the Nest graph; `exports: [ReportsStorageModule]` is invalid | Make `ReportsStorageModule` a real `@Module` that imports `BucketStorageModule.forBucket(...)` |
| WR-01 | warning | `http://` hardcoded in `S3_ENDPOINT.PROTOCOL` constant — breaks production Garage behind Traefik TLS | New required env var `STORAGE_PROTOCOL` (enum http/https); URL assembled from env |
| WR-02 | warning | `S3StorageService.download()` silently returns `Buffer.alloc(0)` when response body is undefined | Throw instead |
| WR-03 | warning | Magic bucket literals `'parser'` and `'reports'` inlined at module config time | Extract to constants colocated with each bucket's module |
| WR-04 | warning | Each `StorageModule.forRootAsync()` call creates its own `S3Client` and `S3ShutdownService` — parser ends up with two of each | `S3CoreModule` — `@Global()` singleton providing one `S3_CLIENT` and one `S3ShutdownService` for the whole service process; per-bucket modules inject the shared client |

**Not in scope:** IN-01 (resolved as side-effect of removing `STORAGE_BUCKET` from schema), IN-02 (cosmetic log string), IN-03 (convention note — no change required).

## Target Architecture

### Foundation — new directory layout

```
packages/foundation/src/storage/
│
├── infrastructure/              # generic plumbing — knows S3, does NOT know concrete buckets
│   ├── s3-core.module.ts            @Global S3Client singleton
│   ├── bucket-storage.module.ts     BucketStorageModule.forBucket() factory
│   ├── s3-storage.service.ts        S3StorageService (implements StoragePort, bucket in ctor)
│   ├── s3.health.ts                 S3HealthIndicator (bucket in ctor)
│   ├── s3-shutdown.service.ts       S3ShutdownService
│   ├── storage.interfaces.ts        StoragePort, StorageHealthIndicator, BucketStorageOptions
│   ├── storage.constants.ts         S3_CLIENT, S3_DEFAULTS, S3_HEALTH_CHECK, STORAGE_ENDPOINT_SEPARATOR, S3_TIME, S3_ERROR_NAME
│   └── index.ts
│
├── reports/                     # concrete shared bucket — "implementation" layer
│   ├── reports-storage.module.ts    ReportsStorageModule (uses BucketStorageModule.forBucket)
│   ├── reports.constants.ts         REPORTS_STORAGE, REPORTS_STORAGE_HEALTH, REPORTS_BUCKET, REPORTS_HEALTH_KEY
│   └── index.ts
│
└── index.ts                     # top-level storage barrel — re-exports both layers
```

**Separation principle:** `infrastructure/` contains primitives that work with any bucket. `reports/` is a concrete configuration of one shared bucket using those primitives. Future shared buckets (`logs/`, `archives/`, etc.) get their own sibling folders with the same three-file pattern.

**Files to delete:** the current flat layout under `packages/foundation/src/storage/`:
- `storage.module.ts` (replaced by `infrastructure/bucket-storage.module.ts`)
- `storage.providers.ts` (provider factory removed — providers inline in new modules)
- `storage.service.ts`, `storage.interfaces.ts`, `storage.constants.ts`, `s3.health.ts`, `s3-shutdown.service.ts` (moved to `infrastructure/`)
- `reports-storage.module.ts` (rewritten in `reports/`)

### S3CoreModule (infrastructure)

```typescript
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: S3_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): S3Client => {
        const protocol = config.get<string>('STORAGE_PROTOCOL')!;
        const endpoint = config.get<string>('STORAGE_ENDPOINT')!;
        const port     = config.get<number>('STORAGE_PORT')!;
        const region   = config.get<string>('STORAGE_REGION')!;
        const accessKeyId     = config.get<string>('STORAGE_ACCESS_KEY')!;
        const secretAccessKey = config.get<string>('STORAGE_SECRET_KEY')!;
        return new S3Client({
          endpoint: `${protocol}${STORAGE_ENDPOINT_SEPARATOR.SCHEME}${endpoint}${STORAGE_ENDPOINT_SEPARATOR.PORT}${port}`,
          region,
          credentials: { accessKeyId, secretAccessKey },
          forcePathStyle: S3_DEFAULTS.FORCE_PATH_STYLE,
          requestChecksumCalculation: S3_DEFAULTS.REQUEST_CHECKSUM,
          responseChecksumValidation: S3_DEFAULTS.RESPONSE_CHECKSUM,
          maxAttempts: S3_DEFAULTS.MAX_ATTEMPTS,
        });
      },
    },
    S3ShutdownService,
  ],
  exports: [S3_CLIENT],
})
export class S3CoreModule {}
```

**Key points:**
- No `forRootAsync()` — no options, all config from env
- `@Global()` — one instance per service process
- Plain module import: `imports: [S3CoreModule]`
- Closes WR-04 (single S3Client + single ShutdownService)
- Closes WR-01 (protocol from env, no hardcoded `http://`)

### BucketStorageModule (infrastructure)

```typescript
@Module({})
export class BucketStorageModule {
  static forBucket(options: BucketStorageOptions): DynamicModule {
    return {
      module: BucketStorageModule,
      imports: [TerminusModule],
      providers: [
        {
          provide: options.token,
          inject: [S3_CLIENT],
          useFactory: (client: S3Client): S3StorageService =>
            new S3StorageService(client, options.bucket),
        },
        {
          provide: options.healthToken,
          inject: [HealthIndicatorService, S3_CLIENT],
          useFactory: (his: HealthIndicatorService, client: S3Client): S3HealthIndicator =>
            new S3HealthIndicator(his, client, options.bucket),
        },
      ],
      exports: [TerminusModule, options.token, options.healthToken],
    };
  }
}
```

**Key points:**
- Does NOT create `S3Client` — injects the shared singleton from `S3CoreModule` via `S3_CLIENT`
- Per-bucket `healthToken` — no more shared `STORAGE_HEALTH` Symbol → closes CR-01
- Still a dynamic module (because options vary per call), but `ReportsStorageModule` and each app's per-service module wrap it so consumers never call `.forBucket()` directly

### BucketStorageOptions interface

```typescript
export interface BucketStorageOptions {
  readonly bucket:      string;
  readonly token:       symbol;
  readonly healthToken: symbol;
  readonly healthKey:   string;
}
```

All four required — no optionals, no defaults.

### ReportsStorageModule (reports/)

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

**Key points:**
- Real `@Module` class that enters Nest's module graph → closes CR-02
- Services just write `imports: [ReportsStorageModule]` — no `.forRootAsync()` ceremony
- Exports only the two public tokens — bucket name and health key stay internal

### reports.constants.ts

```typescript
export const REPORTS_STORAGE = Symbol('REPORTS_STORAGE');
export const REPORTS_STORAGE_HEALTH = Symbol('REPORTS_STORAGE_HEALTH');

export const REPORTS_BUCKET = 'reports';
export const REPORTS_HEALTH_KEY = 's3:reports';
```

Four constants, single source of truth for the reports bucket.

### S3StorageService.download() — WR-02 fix

```typescript
async download(key: string): Promise<Buffer> {
  const response = await this.client.send(
    new GetObjectCommand({ Bucket: this.bucket, Key: key }),
  );
  if (response.Body === undefined) {
    throw new Error(`S3 object has empty body: bucket=${this.bucket} key=${key}`);
  }
  const bytes = await response.Body.transformToByteArray();
  return Buffer.from(bytes);
}
```

Only line 39-41 of the current file changes.

### storage/index.ts (top-level barrel)

```typescript
export * from './infrastructure';
export * from './reports';
```

External consumers import through `@email-platform/foundation` — the folder structure is internal.

### foundation root barrel — packages/foundation/src/index.ts

Unchanged conceptually. Already does `export * from './storage'`. The names being exported shift (`StorageModule` → `S3CoreModule`, `BucketStorageModule`, etc.) but the re-export line itself stays.

### HEALTH constants — foundation/src/health/health-constants.ts

Remove `HEALTH.INDICATOR.S3 = 's3'` — per-bucket health keys now live with each bucket's constants (`REPORTS_HEALTH_KEY = 's3:reports'` in foundation, `PARSER_STORAGE_HEALTH_KEY = 's3:parser'` in parser app). The generic single `'s3'` key is no longer meaningful.

## Parser app — new layout

### apps/parser/src/infrastructure/storage/ (two files now)

```
apps/parser/src/infrastructure/storage/
├── parser-storage.module.ts    # ONLY parser bucket — symmetric to foundation's reports-storage.module.ts
├── storage.module.ts            # composition: ParserStorageModule + ReportsStorageModule
└── index.ts                     # exports only StorageModule (composition)
```

### parser-storage.module.ts

```typescript
import { Module } from '@nestjs/common';
import { BucketStorageModule } from '@email-platform/foundation';
import {
  PARSER_STORAGE,
  PARSER_STORAGE_HEALTH,
  PARSER_STORAGE_BUCKET,
  PARSER_STORAGE_HEALTH_KEY,
} from '../../parser.constants';

@Module({
  imports: [
    BucketStorageModule.forBucket({
      bucket:      PARSER_STORAGE_BUCKET,
      token:       PARSER_STORAGE,
      healthToken: PARSER_STORAGE_HEALTH,
      healthKey:   PARSER_STORAGE_HEALTH_KEY,
    }),
  ],
  exports: [PARSER_STORAGE, PARSER_STORAGE_HEALTH],
})
export class ParserStorageModule {}
```

Pure per-service configuration. Knows ONLY about the parser bucket. Zero imports of reports — the composition module handles cross-cutting.

### storage.module.ts (parser composition)

```typescript
import { Module } from '@nestjs/common';
import { ReportsStorageModule } from '@email-platform/foundation';
import { ParserStorageModule } from './parser-storage.module';

@Module({
  imports: [ParserStorageModule, ReportsStorageModule],
  exports: [ParserStorageModule, ReportsStorageModule],
})
export class StorageModule {}
```

`exports: [ParserStorageModule, ReportsStorageModule]` re-exports all their tokens transparently to consumers (Nest module re-export semantics).

### parser.constants.ts (additions)

```typescript
export const PARSER_STORAGE_HEALTH = Symbol('ParserStorageHealth');

export const PARSER_STORAGE_BUCKET = 'parser';
export const PARSER_STORAGE_HEALTH_KEY = 's3:parser';
```

Existing `PARSER_STORAGE` Symbol kept as-is.

### parser.module.ts (imports change)

```diff
-import { LoggingModule, PersistenceModule } from '@email-platform/foundation';
+import { LoggingModule, PersistenceModule, S3CoreModule } from '@email-platform/foundation';
-import { ParserStorageModule } from './infrastructure/storage';
+import { StorageModule } from './infrastructure/storage';

 @Module({
   imports: [
     AppConfigModule.forRoot(ParserEnvSchema),
     PersistenceModule.forRootAsync(),
-    ParserStorageModule.forRootAsync(),
+    S3CoreModule,
+    StorageModule,
     LoggingModule.forGrpcAsync('parser'),
   ],
```

### parser health.controller.ts (two separate injections)

```typescript
import {
  HEALTH,
  DATABASE_HEALTH,
  REPORTS_STORAGE_HEALTH,
  REPORTS_HEALTH_KEY,
} from '@email-platform/foundation';
import type {
  DatabaseHealthIndicator,
  StorageHealthIndicator,
} from '@email-platform/foundation';
import {
  PARSER_STORAGE_HEALTH,
  PARSER_STORAGE_HEALTH_KEY,
} from '../parser.constants';

@Controller(HEALTH.ROUTE)
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    @Inject(DATABASE_HEALTH)         private readonly db:             DatabaseHealthIndicator,
    @Inject(PARSER_STORAGE_HEALTH)   private readonly parserStorage:  StorageHealthIndicator,
    @Inject(REPORTS_STORAGE_HEALTH)  private readonly reportsStorage: StorageHealthIndicator,
  ) {}

  @Get(HEALTH.READY)
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.db.isHealthy(HEALTH.INDICATOR.POSTGRESQL),
      () => this.parserStorage.isHealthy(PARSER_STORAGE_HEALTH_KEY),
      () => this.reportsStorage.isHealthy(REPORTS_HEALTH_KEY),
    ]);
  }
}
```

## Notifier app — new layout

### apps/notifier/src/infrastructure/storage/ (one file — no own bucket)

```
apps/notifier/src/infrastructure/storage/
├── storage.module.ts   # composition: ReportsStorageModule only
└── index.ts            # exports StorageModule
```

No `notifier-storage.module.ts` file — notifier has no own bucket. If one is added later (e.g., telegram media cache), create `notifier-storage.module.ts` by the same pattern and add to composition.

### storage.module.ts (notifier composition)

```typescript
import { Module } from '@nestjs/common';
import { ReportsStorageModule } from '@email-platform/foundation';

@Module({
  imports: [ReportsStorageModule],
  exports: [ReportsStorageModule],
})
export class StorageModule {}
```

### notifier.module.ts (imports change)

```diff
-import { LoggingModule, RabbitMqHealthIndicator } from '@email-platform/foundation';
+import { LoggingModule, RabbitMqHealthIndicator, S3CoreModule } from '@email-platform/foundation';
-import { NotifierStorageModule } from './infrastructure/storage';
+import { StorageModule } from './infrastructure/storage';

 @Module({
   imports: [
     AppConfigModule.forRoot(NotifierEnvSchema),
     TerminusModule,
-    NotifierStorageModule.forRootAsync(),
+    S3CoreModule,
+    StorageModule,
     LoggingModule.forHttpAsync('notifier'),
   ],
```

**Delete:** the current `apps/notifier/src/infrastructure/storage/notifier-storage.module.ts` file.

### notifier health.controller.ts

```typescript
import {
  RabbitMqHealthIndicator,
  HEALTH,
  REPORTS_STORAGE_HEALTH,
  REPORTS_HEALTH_KEY,
} from '@email-platform/foundation';
import type { StorageHealthIndicator } from '@email-platform/foundation';

@Controller(HEALTH.ROUTE)
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly rabbitmq: RabbitMqHealthIndicator,
    @Inject(REPORTS_STORAGE_HEALTH) private readonly reportsStorage: StorageHealthIndicator,
  ) {}

  @Get(HEALTH.READY)
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.rabbitmq.isHealthy(HEALTH.INDICATOR.RABBITMQ),
      () => this.reportsStorage.isHealthy(REPORTS_HEALTH_KEY),
    ]);
  }
}
```

## Env schema & .env files — APPROVED by user

User approved the following infrastructure-guarded changes in conversation on 2026-04-09.

### packages/config/src/schemas/storage.ts

```diff
 export const StorageSchema = z.object({
+  STORAGE_PROTOCOL:    z.enum(['http', 'https']),
   STORAGE_ENDPOINT:    z.string().min(1),
   STORAGE_PORT:        z.coerce.number(),
   STORAGE_ACCESS_KEY:  z.string().min(1),
   STORAGE_SECRET_KEY:  z.string().min(1),
-  STORAGE_BUCKET:      z.string().min(1),
   STORAGE_REGION:      z.string().min(1),
 });
```

Add `STORAGE_PROTOCOL` (enum, required — no default per env-schema skill), remove orphan `STORAGE_BUCKET`.

### .env

```diff
 STORAGE_ENDPOINT=localhost
 STORAGE_PORT=9000
+STORAGE_PROTOCOL=http
 STORAGE_ACCESS_KEY=minioadmin
 STORAGE_SECRET_KEY=minioadmin
-STORAGE_BUCKET=email-platform
 STORAGE_REGION=us-east-1
```

### .env.docker

```diff
 STORAGE_ENDPOINT=minio
 STORAGE_PORT=9000
+STORAGE_PROTOCOL=http
 STORAGE_ACCESS_KEY=minioadmin
 STORAGE_SECRET_KEY=minioadmin
-STORAGE_BUCKET=email-platform
 STORAGE_REGION=us-east-1
```

### .env.example

```diff
 STORAGE_ENDPOINT=localhost
 STORAGE_PORT=9000
+STORAGE_PROTOCOL=http
 STORAGE_ACCESS_KEY=minioadmin
 STORAGE_SECRET_KEY=minioadmin
-STORAGE_BUCKET=email-platform
 STORAGE_REGION=us-east-1
```

### Coolify production — handled by user, NOT in this plan

User will manually add `STORAGE_PROTOCOL=https` and adjust endpoint/port for Garage in Coolify's environment UI. Plan must NOT attempt to modify any production config files.

## Skill constraints (must not violate)

- **no-magic-values:** All Symbols (Symbol constructor), all constants in `*.constants.ts` files, bucket names as named constants, health keys as named constants. Confirmed above.
- **branching-patterns:** No switch/case, no if/else chains (3+). N/A for this refactor — no behavior selection logic.
- **twelve-factor:** No `process.env`, no `NODE_ENV`/`isDev`/`isProd`. All config through `ConfigService` + Zod schema. Confirmed above — all `config.get()` calls via `ConfigService`.
- **env-schema:** No `.default()`, no `.optional()`, no `z.coerce.boolean()`. `STORAGE_PROTOCOL` uses `z.enum(['http', 'https'])` (required). Note: `STORAGE_PORT` keeps its existing `z.coerce.number()` — not touched in this plan, predates phase 22.
- **infrastructure-guard:** `.env*` and schema changes are explicitly approved by user. No other infrastructure changes.
- **clean-ddd-hexagonal:** `packages/foundation/` uses simple utility structure (not DDD). `apps/` stays Clean/DDD/Hexagonal — per-service `StorageModule` composition lives in `infrastructure/storage/` layer as before.

## Commit plan (atomic, sequenced)

Plan 22-03 should execute as approximately this sequence of atomic commits. Exact grouping is at the planner's discretion if it improves cohesion, but the number of logical changes and the sequence order (env → foundation core → foundation reports → foundation cleanup → parser → notifier) must be preserved.

1. `refactor(22-03): add STORAGE_PROTOCOL env var, remove orphan STORAGE_BUCKET` — schema + 3 .env files
2. `refactor(22-03): create storage/infrastructure folder with primitives` — move+edit constants, interfaces, service (+ WR-02 throw fix), health, shutdown into `infrastructure/`; delete old flat files
3. `feat(22-03): add S3CoreModule global singleton` — `infrastructure/s3-core.module.ts`
4. `feat(22-03): add BucketStorageModule factory with per-bucket health tokens` — `infrastructure/bucket-storage.module.ts`; new `BucketStorageOptions` interface; delete old `storage.module.ts` + `storage.providers.ts`
5. `refactor(22-03): isolate reports bucket in storage/reports folder` — `reports/reports.constants.ts`, `reports/reports-storage.module.ts`, `reports/index.ts`; delete old `reports-storage.module.ts`
6. `refactor(22-03): update foundation storage barrel and remove HEALTH.INDICATOR.S3` — `storage/index.ts`, `health/health-constants.ts`
7. `refactor(22-03): split parser storage into ParserStorageModule and StorageModule composition` — new `parser-storage.module.ts` (per-bucket only), new `storage.module.ts` (composition), updated `parser.constants.ts`, updated `index.ts` barrel
8. `fix(22-03): wire parser health controller to per-bucket storage tokens` — `parser/health/health.controller.ts`, `parser.module.ts` (add `S3CoreModule`, use composition `StorageModule`)
9. `refactor(22-03): collapse notifier storage to composition-only StorageModule` — new `storage.module.ts`, delete `notifier-storage.module.ts`, update `index.ts` barrel
10. `fix(22-03): wire notifier health controller to REPORTS_STORAGE_HEALTH` — `notifier/health/health.controller.ts`, `notifier.module.ts` (add `S3CoreModule`, use composition `StorageModule`)
11. `docs(22-03): mark review findings resolved and update summaries` — `22-REVIEW.md` status to `resolved`, add fix-reference notes to `22-01-SUMMARY.md` and `22-02-SUMMARY.md`

After all commits: `pnpm build` MUST pass (10/10 packages green), and no `MINIO_` / `http://` string should appear in final foundation source.

## Acceptance criteria (Plan 22-03 goal-backward)

A plan is successful if and only if ALL of the following hold after execution:

- [ ] `22-REVIEW.md` findings CR-01, CR-02, WR-01, WR-02, WR-03, WR-04 marked `resolved`
- [ ] `packages/foundation/src/storage/infrastructure/` directory exists with all primitives
- [ ] `packages/foundation/src/storage/reports/` directory exists with `ReportsStorageModule` + constants
- [ ] `packages/foundation/src/storage/storage.module.ts` does NOT exist (replaced by `infrastructure/bucket-storage.module.ts`)
- [ ] `packages/foundation/src/storage/storage.providers.ts` does NOT exist
- [ ] `packages/foundation/src/storage/reports-storage.module.ts` (old flat location) does NOT exist
- [ ] `S3CoreModule` exists as `@Global()` and provides `S3_CLIENT` + `S3ShutdownService`
- [ ] `BucketStorageModule.forBucket()` injects `S3_CLIENT` (does NOT create its own `S3Client`)
- [ ] `ReportsStorageModule` is a real `@Module` class (NOT an alias returning `DynamicModule` with `module: StorageModule`)
- [ ] Zero occurrences of the string `'http://'` in `packages/foundation/src/storage/`
- [ ] `STORAGE_PROTOCOL` appears in `packages/config/src/schemas/storage.ts`, `.env`, `.env.docker`, `.env.example`
- [ ] `STORAGE_BUCKET` does NOT appear in `packages/config/src/schemas/storage.ts`, `.env`, `.env.docker`, `.env.example`
- [ ] `apps/parser/src/infrastructure/storage/parser-storage.module.ts` contains ONLY parser bucket wiring (no `ReportsStorageModule` import)
- [ ] `apps/parser/src/infrastructure/storage/storage.module.ts` exists with composition of `ParserStorageModule` + `ReportsStorageModule`
- [ ] `apps/notifier/src/infrastructure/storage/storage.module.ts` exists and imports only `ReportsStorageModule`
- [ ] `apps/notifier/src/infrastructure/storage/notifier-storage.module.ts` (old file) does NOT exist
- [ ] Parser `health.controller.ts` injects two separate tokens: `PARSER_STORAGE_HEALTH` AND `REPORTS_STORAGE_HEALTH`
- [ ] Notifier `health.controller.ts` injects `REPORTS_STORAGE_HEALTH` (not old `STORAGE_HEALTH`)
- [ ] `HEALTH.INDICATOR.S3` removed from `packages/foundation/src/health/health-constants.ts`
- [ ] `STORAGE_HEALTH` Symbol removed from foundation exports
- [ ] `pnpm build` succeeds — all 10 workspace packages green
- [ ] Grep for `process.env` in new/changed foundation+app files: zero matches
- [ ] Grep for inline bucket literals `'parser'` or `'reports'` in module files: zero matches (must come from constants)

## Files touched (for plan frontmatter files_modified)

### Foundation
- `packages/config/src/schemas/storage.ts` (modified)
- `packages/foundation/src/storage/infrastructure/s3-core.module.ts` (new)
- `packages/foundation/src/storage/infrastructure/bucket-storage.module.ts` (new)
- `packages/foundation/src/storage/infrastructure/s3-storage.service.ts` (moved+modified: WR-02)
- `packages/foundation/src/storage/infrastructure/s3.health.ts` (moved)
- `packages/foundation/src/storage/infrastructure/s3-shutdown.service.ts` (moved)
- `packages/foundation/src/storage/infrastructure/storage.interfaces.ts` (moved+modified: BucketStorageOptions replaces StorageModuleOptions)
- `packages/foundation/src/storage/infrastructure/storage.constants.ts` (moved+modified: remove STORAGE_HEALTH and S3_ENDPOINT.PROTOCOL; add STORAGE_ENDPOINT_SEPARATOR)
- `packages/foundation/src/storage/infrastructure/index.ts` (new)
- `packages/foundation/src/storage/reports/reports.constants.ts` (new)
- `packages/foundation/src/storage/reports/reports-storage.module.ts` (new)
- `packages/foundation/src/storage/reports/index.ts` (new)
- `packages/foundation/src/storage/index.ts` (modified)
- `packages/foundation/src/storage/storage.module.ts` (deleted)
- `packages/foundation/src/storage/storage.providers.ts` (deleted)
- `packages/foundation/src/storage/storage.service.ts` (deleted — moved)
- `packages/foundation/src/storage/storage.interfaces.ts` (deleted — moved)
- `packages/foundation/src/storage/storage.constants.ts` (deleted — moved)
- `packages/foundation/src/storage/s3.health.ts` (deleted — moved)
- `packages/foundation/src/storage/s3-shutdown.service.ts` (deleted — moved)
- `packages/foundation/src/storage/reports-storage.module.ts` (deleted — moved to reports/)
- `packages/foundation/src/health/health-constants.ts` (modified)

### Parser app
- `apps/parser/src/parser.constants.ts` (modified)
- `apps/parser/src/infrastructure/storage/parser-storage.module.ts` (rewritten)
- `apps/parser/src/infrastructure/storage/storage.module.ts` (new)
- `apps/parser/src/infrastructure/storage/index.ts` (modified)
- `apps/parser/src/parser.module.ts` (modified)
- `apps/parser/src/health/health.controller.ts` (modified)

### Notifier app
- `apps/notifier/src/infrastructure/storage/storage.module.ts` (new)
- `apps/notifier/src/infrastructure/storage/notifier-storage.module.ts` (deleted)
- `apps/notifier/src/infrastructure/storage/index.ts` (modified)
- `apps/notifier/src/notifier.module.ts` (modified)
- `apps/notifier/src/health/health.controller.ts` (modified)

### Env files
- `.env` (modified)
- `.env.docker` (modified)
- `.env.example` (modified)

### Docs
- `.planning/phases/22-s3-storagemodule/22-REVIEW.md` (status update)
- `.planning/phases/22-s3-storagemodule/22-01-SUMMARY.md` (fix-reference)
- `.planning/phases/22-s3-storagemodule/22-02-SUMMARY.md` (fix-reference)

## Out of scope (DO NOT touch)

- `STORAGE_PORT z.coerce.number()` — predates phase 22, separate concern
- `STORAGE_PORT` as a value — not changing ports anywhere
- Any Coolify / production env — user handles manually
- `docker-compose*.yml` files — infrastructure-guarded, no changes
- MinIO / Garage server configuration — out of code scope
- IN-02 (log string cosmetic), IN-03 (convention note)
- Adding tests — project explicit constraint "без тестов"
- Any phase other than 22

## Reference files

The planner should read these for additional context when creating PLAN.md:

- `.planning/phases/22-s3-storagemodule/22-REVIEW.md` — the 9 findings being addressed
- `.planning/phases/22-s3-storagemodule/22-CONTEXT.md` — original phase 22 decisions (D-01 through D-19)
- `.planning/phases/22-s3-storagemodule/22-RESEARCH.md` — original technical research
- `.planning/phases/22-s3-storagemodule/22-01-SUMMARY.md` — what Wave 1 built (current state)
- `.planning/phases/22-s3-storagemodule/22-02-SUMMARY.md` — what Wave 2 built (current state)
- `packages/foundation/src/cache/` — CacheModule reference (what the current storage wrongly copied; useful for comparison of what stays the same vs what differs)
- `packages/foundation/src/persistence/` — DrizzleModule / PG_POOL pattern (closest existing analogue to `S3CoreModule` singleton-then-factory split)
