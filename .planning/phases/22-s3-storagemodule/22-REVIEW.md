---
phase: 22-s3-storagemodule
reviewed: 2026-04-09T10:20:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - apps/notifier/src/health/health.controller.ts
  - apps/notifier/src/infrastructure/storage/index.ts
  - apps/notifier/src/infrastructure/storage/notifier-storage.module.ts
  - apps/notifier/src/notifier.module.ts
  - apps/parser/src/health/health.controller.ts
  - apps/parser/src/infrastructure/storage/index.ts
  - apps/parser/src/infrastructure/storage/parser-storage.module.ts
  - apps/parser/src/parser.constants.ts
  - apps/parser/src/parser.module.ts
  - packages/foundation/package.json
  - packages/foundation/src/health/health-constants.ts
  - packages/foundation/src/index.ts
  - packages/foundation/src/storage/index.ts
  - packages/foundation/src/storage/reports-storage.module.ts
  - packages/foundation/src/storage/s3-shutdown.service.ts
  - packages/foundation/src/storage/s3.health.ts
  - packages/foundation/src/storage/storage.constants.ts
  - packages/foundation/src/storage/storage.interfaces.ts
  - packages/foundation/src/storage/storage.module.ts
  - packages/foundation/src/storage/storage.providers.ts
  - packages/foundation/src/storage/storage.service.ts
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: resolved
resolution:
  resolved_at: 2026-04-09
  resolved_by: "Plan 22-03 (code review fixes)"
  findings_closed: [CR-01, CR-02, WR-01, WR-02, WR-03, WR-04]
  findings_out_of_scope: [IN-02, IN-03]
  findings_side_effect_closed: [IN-01]
---

# Phase 22: Code Review Report

**Reviewed:** 2026-04-09T10:20:00Z
**Depth:** standard
**Files Reviewed:** 21
**Status:** resolved (via Plan 22-03)

## Resolution Status — 2026-04-09

**Plan 22-03 closes CR-01, CR-02, WR-01, WR-02, WR-03, WR-04.**

Architecture changes (see `22-CODE-REVIEW-NOTES.md` for full design):
- Storage module split into `infrastructure/` (primitives) and `reports/` (concrete shared bucket)
- `S3CoreModule` @Global singleton — one `S3Client` + one `S3ShutdownService` per process (WR-04)
- `BucketStorageModule.forBucket()` factory with per-bucket `token` and `healthToken` (CR-01)
- `ReportsStorageModule` is now a real `@Module` class (CR-02)
- `STORAGE_PROTOCOL` env var (http|https enum) replaces hardcoded `http://` (WR-01)
- `S3StorageService.download()` throws on empty body (WR-02)
- Bucket names `REPORTS_BUCKET`, `PARSER_STORAGE_BUCKET` as named constants (WR-03)

IN-01 closed as side-effect (orphan `STORAGE_BUCKET` env var removed).
IN-02, IN-03 remain out-of-scope (cosmetic / convention notes).

## Summary

Phase 22 introduces `StorageModule` in `@email-platform/foundation` plus per-service wiring for parser and notifier. The module structure mirrors the Phase 21 CacheModule pattern: dynamic `forRootAsync()`, Symbol DI tokens, `@Injectable` health indicator, `OnApplicationShutdown` service, and barrel re-exports. Code is type-safe, uses Symbol DI tokens consistently, no `any`, no environment branching, and no direct `process.env` reads — the project skills are generally respected at the file level.

However, the composition of two `StorageModule` instances inside `ParserStorageModule` introduces two DI correctness problems that are not caught by `pnpm build` (TypeScript only checks types, not Nest's runtime DI graph) and that have not been exercised by a runtime boot (phase 22 is tests-out-of-scope). Both issues are likely to produce incorrect behavior at service startup:

1. `STORAGE_HEALTH` is exported by both dynamic `StorageModule` instances, leaving the parser's health controller silently bound to whichever import wins (most likely the `reports` bucket, not `parser`).
2. `ParserStorageModule.exports` lists `ReportsStorageModule`, but `ReportsStorageModule.forRootAsync()` returns a `DynamicModule` whose `module` field is `StorageModule` — the `ReportsStorageModule` class reference never appears in the imports graph, so the export is dead or will raise a runtime error.

In addition, the S3 endpoint protocol is hardcoded `http://` with no way to override, which will break HTTPS-fronted Garage/S3 in production, and a few quality issues (bucket names as inline literals, unused required env var, silent `download()` fallback).

Recommend fixing the two Critical items before the parser/notifier services are booted against real Garage/S3. The production HTTPS issue (W-01) is blocking for prod deploy and should be scheduled before any external rollout.

## Critical Issues

### CR-01: Ambiguous `STORAGE_HEALTH` binding in parser — health check may report on wrong bucket

**File:** `apps/parser/src/infrastructure/storage/parser-storage.module.ts:10-14`
**Also:** `packages/foundation/src/storage/storage.module.ts:14`

**Issue:**
`ParserStorageModule.forRootAsync()` imports two dynamic `StorageModule` instances in the same module scope:

```typescript
imports: [
  StorageModule.forRootAsync({ bucket: 'parser', token: PARSER_STORAGE }),
  ReportsStorageModule.forRootAsync(),   // internally returns StorageModule.forRootAsync({ bucket: 'reports', token: REPORTS_STORAGE })
],
```

Each `StorageModule` instance declares `exports: [TerminusModule, options.token, STORAGE_HEALTH]`. Since `STORAGE_HEALTH` is the same `Symbol` in both instances, parser's module graph ends up with two distinct providers sharing the same export token — one factory-bound to the `parser` bucket (via `useExisting: S3HealthIndicator` in the first dynamic module), one factory-bound to the `reports` bucket (in the second).

When `HealthController` injects `STORAGE_HEALTH`, Nest resolves it to whichever matching export it encounters last in the graph traversal. In practice this means the parser's `/health/ready` endpoint runs `HeadBucketCommand` against the **reports** bucket, not the `parser` bucket — silently checking the wrong resource. A parser-bucket outage would go undetected while the reports bucket is healthy.

The `options.token` export (`PARSER_STORAGE` vs `REPORTS_STORAGE`) is not affected because the two tokens are distinct Symbols.

**Fix:**
Either (a) stop exporting `STORAGE_HEALTH` from the foundation `StorageModule` and expose a per-token health indicator instead, or (b) let services compose their own `HealthController` with explicit per-bucket health checks.

Option (b) is the minimum-change fix and aligns with how the cache module avoids this (only one CacheModule per service). Introduce a second health token for the parser-owned bucket:

```typescript
// packages/foundation/src/storage/storage.interfaces.ts
export interface StorageModuleOptions {
  bucket: string;
  token: symbol;
  healthToken?: symbol;   // NEW — per-bucket health indicator export
}

// packages/foundation/src/storage/storage.providers.ts
const storageHealthProvider: Provider = {
  provide: options.healthToken ?? STORAGE_HEALTH,
  useExisting: S3HealthIndicator,
};
// and export options.healthToken ?? STORAGE_HEALTH from storage.module.ts
```

Then in parser:

```typescript
// apps/parser/src/parser.constants.ts
export const PARSER_STORAGE_HEALTH = Symbol('ParserStorageHealth');

// apps/parser/src/infrastructure/storage/parser-storage.module.ts
imports: [
  StorageModule.forRootAsync({
    bucket: 'parser',
    token: PARSER_STORAGE,
    healthToken: PARSER_STORAGE_HEALTH,
  }),
  ReportsStorageModule.forRootAsync(),   // keeps default STORAGE_HEALTH for reports bucket
],
exports: [StorageModule, ReportsStorageModule],

// apps/parser/src/health/health.controller.ts
constructor(
  private readonly health: HealthCheckService,
  @Inject(DATABASE_HEALTH) private readonly db: DatabaseHealthIndicator,
  @Inject(PARSER_STORAGE_HEALTH) private readonly parserStorage: StorageHealthIndicator,
  @Inject(STORAGE_HEALTH) private readonly reportsStorage: StorageHealthIndicator,
) {}

readiness() {
  return this.health.check([
    () => this.db.isHealthy(HEALTH.INDICATOR.POSTGRESQL),
    () => this.parserStorage.isHealthy('s3_parser'),
    () => this.reportsStorage.isHealthy('s3_reports'),
  ]);
}
```

Also add `HEALTH.INDICATOR.S3_PARSER` / `S3_REPORTS` constants in `health-constants.ts` so the indicator keys are not inline strings.

Notifier is unaffected (single `ReportsStorageModule` import), so its current wiring remains correct.

---

### CR-02: `ParserStorageModule.exports` references `ReportsStorageModule` which is never in the imports graph — invalid export

**File:** `apps/parser/src/infrastructure/storage/parser-storage.module.ts:11-14`
**Also:** `packages/foundation/src/storage/reports-storage.module.ts:7-12`

**Issue:**
`ReportsStorageModule.forRootAsync()` is implemented as a pass-through:

```typescript
// packages/foundation/src/storage/reports-storage.module.ts
static forRootAsync(): DynamicModule {
  return StorageModule.forRootAsync({
    bucket: 'reports',
    token: REPORTS_STORAGE,
  });
}
```

It returns `StorageModule.forRootAsync(...)` directly. The resulting `DynamicModule` has `module: StorageModule` (set by `StorageModule.forRootAsync` at `storage.module.ts:11`), not `module: ReportsStorageModule`. The `ReportsStorageModule` class is never registered in Nest's module graph — it is merely a factory shortcut.

`ParserStorageModule.forRootAsync()` then declares:

```typescript
exports: [StorageModule, ReportsStorageModule],
```

Nest resolves `exports` by matching each entry against a module that appears in `imports`. `StorageModule` matches (both dynamic imports have `module: StorageModule`). `ReportsStorageModule` does **not** match anything — its class reference is never in the imports graph. Depending on the Nest version this either (a) silently no-ops (providers from the second StorageModule are still re-exported because `StorageModule` in exports catches both instances), or (b) throws `Nest cannot export a provider/module that is not a part of the currently processed module`.

Notifier has the same pattern but with a single module:

```typescript
// apps/notifier/src/infrastructure/storage/notifier-storage.module.ts
imports: [ReportsStorageModule.forRootAsync()],
exports: [ReportsStorageModule],
```

Here `ReportsStorageModule` is still absent from the imports graph (because `forRootAsync()` returns a `StorageModule` DynamicModule), so the export is also invalid. The reason notifier does not crash today is that no runtime boot has been performed — `pnpm build` does not exercise Nest DI resolution.

**Fix:**
Make `ReportsStorageModule` a real NestJS module whose class is actually registered. Two options:

**Option A — have `ReportsStorageModule.forRootAsync()` return itself with a nested import:**

```typescript
// packages/foundation/src/storage/reports-storage.module.ts
import { Module, type DynamicModule } from '@nestjs/common';
import { REPORTS_STORAGE, STORAGE_HEALTH } from './storage.constants';
import { StorageModule } from './storage.module';

@Module({})
export class ReportsStorageModule {
  static forRootAsync(): DynamicModule {
    return {
      module: ReportsStorageModule,
      imports: [
        StorageModule.forRootAsync({
          bucket: 'reports',
          token: REPORTS_STORAGE,
        }),
      ],
      exports: [StorageModule],   // re-export the inner StorageModule
    };
  }
}
```

Now `ReportsStorageModule` is a genuine module class in Nest's graph, and `exports: [ReportsStorageModule]` in the per-service wrappers will resolve correctly.

**Option B — drop `ReportsStorageModule` and have services call `StorageModule.forRootAsync({ bucket: 'reports', token: REPORTS_STORAGE })` directly.**

This removes the wrapper entirely. It contradicts plan decision D-06 ("root modules never call `StorageModule.forRootAsync` directly"), so Option A is preferable.

Verify the fix by adding a smoke boot of parser/notifier (`NestFactory.create()`) to CI even in the absence of functional tests — this is the only way to catch module-graph bugs that the compiler cannot see.

## Warnings

### WR-01: S3 endpoint protocol hardcoded to `http://` — breaks HTTPS/production deploys

**File:** `packages/foundation/src/storage/storage.constants.ts:17-19`
**Also:** `packages/foundation/src/storage/storage.providers.ts:27`

**Issue:**

```typescript
// storage.constants.ts
export const S3_ENDPOINT = {
  PROTOCOL: 'http://',
  PORT_SEPARATOR: ':',
} as const;

// storage.providers.ts
endpoint: `${S3_ENDPOINT.PROTOCOL}${endpoint}${S3_ENDPOINT.PORT_SEPARATOR}${port}`,
```

The protocol is baked in as `http://`. Per project memory (`project_hosting_infra.md`, `project_infra_topology.md`), the production Garage instance is served via dual Traefik with TLS at `s3.email-platform.pp.ua`. A production `.env` of the form `STORAGE_ENDPOINT=s3.email-platform.pp.ua`, `STORAGE_PORT=443` would yield `http://s3.email-platform.pp.ua:443` — an http scheme pointing at an https port, which the AWS SDK cannot talk to. There is no `STORAGE_PROTOCOL` / `STORAGE_USE_SSL` env var in `packages/config/src/schemas/storage.ts` to override this, and the twelve-factor skill (Factor X — Dev/Prod Parity) prohibits encoding environment-specific assumptions in code.

Also a no-magic-values concern: extracting `'http://'` to `S3_ENDPOINT.PROTOCOL` is cosmetic — a named constant of a wrong value is still a wrong value. The fix is not a better name, it is to drop the constant and source the protocol from config (or from a full `STORAGE_ENDPOINT_URL` env var).

**Fix:**
Remove `S3_ENDPOINT.PROTOCOL` and construct a full URL from config. The cleanest change is to require operators to supply the scheme themselves:

```typescript
// packages/config/src/schemas/storage.ts
export const StorageSchema = z.object({
  STORAGE_ENDPOINT: z.string().url(),   // must be full URL, e.g. https://s3.email-platform.pp.ua
  STORAGE_ACCESS_KEY: z.string().min(1),
  STORAGE_SECRET_KEY: z.string().min(1),
  STORAGE_REGION: z.string().min(1),
});
```

```typescript
// packages/foundation/src/storage/storage.providers.ts
useFactory: (config: ConfigService): S3Client => {
  const endpoint = config.get<string>('STORAGE_ENDPOINT')!;
  const region = config.get<string>('STORAGE_REGION')!;
  const accessKeyId = config.get<string>('STORAGE_ACCESS_KEY')!;
  const secretAccessKey = config.get<string>('STORAGE_SECRET_KEY')!;
  return new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: S3_DEFAULTS.FORCE_PATH_STYLE,
    requestChecksumCalculation: S3_DEFAULTS.REQUEST_CHECKSUM,
    responseChecksumValidation: S3_DEFAULTS.RESPONSE_CHECKSUM,
    maxAttempts: S3_DEFAULTS.MAX_ATTEMPTS,
  });
},
```

This collapses `STORAGE_ENDPOINT` + `STORAGE_PORT` into a single `STORAGE_ENDPOINT` URL. Update `.env`, `.env.docker`, and `.env.example` accordingly (local: `http://localhost:9000`, docker: `http://minio:9000`, prod: `https://s3.email-platform.pp.ua`). The `STORAGE_PORT` field in `packages/config/src/schemas/storage.ts` can be removed.

Note: this is an infrastructure-touching change — confirm with the user before modifying `.env*` files (infrastructure-guard skill).

---

### WR-02: `S3StorageService.download()` silently returns empty buffer on missing body

**File:** `packages/foundation/src/storage/storage.service.ts:32-44`

**Issue:**

```typescript
async download(key: string): Promise<Buffer> {
  const response = await this.client.send(
    new GetObjectCommand({ Bucket: this.bucket, Key: key }),
  );
  if (response.Body === undefined) {
    return Buffer.alloc(0);     // silent empty-buffer fallback
  }
  const bytes = await response.Body.transformToByteArray();
  return Buffer.from(bytes);
}
```

`GetObjectCommand` on a non-existent key throws `NoSuchKey` — it does not return `response.Body === undefined`. In practice, `Body` is always defined for a successful `GetObject` on S3-compatible storage. If the SDK ever does return `undefined`, it is an unexpected corner case (network truncation, server bug, SDK change). Returning `Buffer.alloc(0)` hides this from the caller, who cannot distinguish a legitimately empty object from a broken response. This contradicts the rest of the service, which lets errors propagate (`upload`, `delete`) or returns a typed boolean (`exists`).

**Fix:**
Treat undefined body as an error. Either throw or return a typed result; do not fabricate empty data.

```typescript
async download(key: string): Promise<Buffer> {
  const response = await this.client.send(
    new GetObjectCommand({ Bucket: this.bucket, Key: key }),
  );
  if (response.Body === undefined) {
    throw new Error(`S3 GetObject returned no body for key ${key}`);
  }
  const bytes = await response.Body.transformToByteArray();
  return Buffer.from(bytes);
}
```

Extract the error message to a constant in `storage.constants.ts` (per no-magic-values) if it becomes user-visible.

---

### WR-03: Bucket names `'parser'` and `'reports'` are inline string literals

**File:** `apps/parser/src/infrastructure/storage/parser-storage.module.ts:11`
**Also:** `packages/foundation/src/storage/reports-storage.module.ts:9`

**Issue:**
`bucket: 'parser'` and `bucket: 'reports'` are bare string literals used as storage identifiers. The no-magic-values skill classifies these as "string used as identifier/key" and requires extraction to an `as const` object. The Phase 22 summary rationalizes these as one-use literals and compares them to `namespace: 'sender'` in the CacheModule, but:
- The `'reports'` literal is referenced semantically twice — once in `reports-storage.module.ts` and once in the `REPORTS_STORAGE` Symbol name (`Symbol('REPORTS_STORAGE')`), so it is conceptually already a shared identifier.
- Bucket names are deployment-coupled (they must match whatever Garage/MinIO was provisioned with). Hardcoding them in application code means operators cannot change a bucket without a code redeploy.

**Fix:**
Either (a) extract to a named constant in `storage.constants.ts`:

```typescript
export const STORAGE_BUCKET_NAME = {
  REPORTS: 'reports',
  PARSER: 'parser',
} as const;
```

or (b) source bucket names from env so deployment controls them. The existing `STORAGE_BUCKET` env var is currently required-but-unused (see IN-02) — this could become a structured namespaced config instead.

Option (a) is the smaller change and matches current plan intent. Option (b) is the twelve-factor-aligned choice.

---

### WR-04: `S3ShutdownService` not exported from foundation barrel — services cannot opt out or override

**File:** `packages/foundation/src/storage/index.ts:1-14`
**Also:** `packages/foundation/src/storage/storage.providers.ts:65`

**Issue:**
`S3ShutdownService` is registered as a provider inside `storageProviders()` but is not exported from `packages/foundation/src/storage/index.ts`. That is deliberate per plan D-04 (no raw client leak), and the intent is that each `StorageModule.forRootAsync()` call registers its own shutdown hook.

The side effect is that with the current parser composition (two `StorageModule` imports), there are two `S3ShutdownService` instances, each with its own private `S3Client`, each firing `OnApplicationShutdown`. This is functionally correct (both clients get destroyed) but wasteful — parser opens two S3 client pools at boot for what should be one. It also compounds CR-01: two clients, two health indicators, two shutdown services, only one of each observable via the DI exports.

The design assumes clients are per-bucket, but `S3Client` is bucket-agnostic — the bucket is passed per command, not per client. A single client can serve any number of buckets.

**Fix:**
Restructure `StorageModule` so the `S3Client` is shared across all bucket instances in a service:

- Extract `S3Client` creation into a separate `S3ClientModule` (or a `@Global()` module with `S3_CLIENT` + `S3ShutdownService`).
- Have `StorageModule.forRootAsync({ bucket, token })` depend on the shared `S3Client` and only provide the per-bucket `S3StorageService` and `S3HealthIndicator`.

This also fixes CR-01 mechanically: with only one `S3_CLIENT` and one `S3ShutdownService`, the per-bucket health indicator providers can be given distinct tokens without multiplying lifecycle services. Same pattern that `DrizzleModule` uses for the shared `PG_POOL`.

## Info

### IN-01: `STORAGE_BUCKET` required in env schema but never read by code

**File:** `packages/config/src/schemas/storage.ts:8`

**Issue:**
`StorageSchema` declares `STORAGE_BUCKET: z.string().min(1)` — required. `storage.providers.ts` never reads this field. Operators must set a value in every `.env*` file that the application never uses. This is schema/code drift: the contract says "required" but the code treats it as ignored. Per the env-schema skill, schemas should validate exactly what the code consumes.

**Fix:**
Remove `STORAGE_BUCKET` from `packages/config/src/schemas/storage.ts` (and from `.env`, `.env.docker`, `.env.example`). Bucket names are now controlled by per-service `StorageModule` wiring per plan D-07. Confirm removal with the user — this is an env-file change (infrastructure-guard).

If the intent is to eventually derive bucket names from config (see WR-03 option b), leave the schema field in place and add a TODO referencing the target phase.

---

### IN-02: `S3_HEALTH_CHECK.DOWN_MESSAGE` is a log/user string, not a key — borderline for the no-magic-values rule

**File:** `packages/foundation/src/storage/storage.constants.ts:12-14`
**Also:** `packages/foundation/src/storage/s3.health.ts:21`

**Issue:**
`S3_HEALTH_CHECK.DOWN_MESSAGE = 'S3 storage connection failed'` is extracted to a constant, but the no-magic-values skill explicitly allows human-readable log messages inline. Extraction here is not harmful but is extra indirection without benefit — the constant has exactly one consumer and is a message string, not a DI key. Compare with `REDIS_HEALTH_CHECK.DOWN_MESSAGE` in `cache.constants.ts` which has the same shape — this review flags it as a consistency note, not a required change.

**Fix:**
Optional — leave as-is for consistency with `REDIS_HEALTH_CHECK`. If simplifying, inline the string directly in `s3.health.ts` and delete `S3_HEALTH_CHECK` from constants. Either choice is acceptable.

---

### IN-03: `storageProviders()` helper is a free function; cache uses the same pattern — consider a shared convention doc

**File:** `packages/foundation/src/storage/storage.providers.ts:16`

**Issue:**
`storageProviders(options: StorageModuleOptions): Provider[]` is a free factory function called from `StorageModule.forRootAsync()`. The cache module uses the identical pattern (`cacheProviders(options)` in `cache/cache.providers.ts`). Both are fine and consistent. No fix required — noting for posterity that this is a repeated convention and future foundation modules (e.g., a future messaging module) should follow the same shape.

**Fix:**
None — this is a pattern-consistency note for Phase 22+ reviewers and the eventual `foundation/README.md` (if added).

---

_Reviewed: 2026-04-09T10:20:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
