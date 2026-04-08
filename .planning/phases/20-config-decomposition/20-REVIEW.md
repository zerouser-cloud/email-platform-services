---
phase: 20-config-decomposition
reviewed: 2026-04-08T12:00:00Z
depth: standard
files_reviewed: 32
files_reviewed_list:
  - packages/config/src/schemas/database.ts
  - packages/config/src/schemas/redis.ts
  - packages/config/src/schemas/rabbitmq.ts
  - packages/config/src/schemas/storage.ts
  - packages/config/src/schemas/logging.ts
  - packages/config/src/schemas/grpc.ts
  - packages/config/src/schemas/cors.ts
  - packages/config/src/schemas/rate-limit.ts
  - packages/config/src/schemas/index.ts
  - packages/config/src/compose.ts
  - packages/config/src/config-loader.ts
  - packages/config/src/app-config.module.ts
  - packages/config/src/env-schema.ts
  - packages/config/src/index.ts
  - apps/auth/src/infrastructure/config/auth-env.schema.ts
  - apps/auth/src/auth.module.ts
  - apps/auth/src/main.ts
  - apps/gateway/src/infrastructure/config/gateway-env.schema.ts
  - apps/gateway/src/gateway.module.ts
  - apps/gateway/src/main.ts
  - apps/sender/src/infrastructure/config/sender-env.schema.ts
  - apps/sender/src/sender.module.ts
  - apps/sender/src/main.ts
  - apps/parser/src/infrastructure/config/parser-env.schema.ts
  - apps/parser/src/parser.module.ts
  - apps/parser/src/main.ts
  - apps/audience/src/infrastructure/config/audience-env.schema.ts
  - apps/audience/src/audience.module.ts
  - apps/audience/src/main.ts
  - apps/notifier/src/infrastructure/config/notifier-env.schema.ts
  - apps/notifier/src/notifier.module.ts
  - apps/notifier/src/main.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-04-08T12:00:00Z
**Depth:** standard
**Files Reviewed:** 32
**Status:** issues_found

## Summary

The config decomposition is well-structured. Each service composes only the env schemas it needs via `composeSchemas()`, and the `AppConfigModule.forRoot(schema)` pattern cleanly integrates with NestJS DI. The env-schema skill rules are respected: no `.default()`, no `.optional()`, no `z.coerce.boolean()`, and boolean transforms use `z.string().transform(v => v === 'true')`.

Four warnings found: a silent key collision risk in `composeSchemas`, missing port range validation in `TopologySchema` and `StorageSchema`, and the `STORAGE_PORT` field lacking a `.positive()` constraint. Three info-level items related to code duplication and TODO comments.

## Warnings

### WR-01: composeSchemas silently overwrites on key collision

**File:** `packages/config/src/compose.ts:20`
**Issue:** `Object.assign(merged, schema.shape)` will silently overwrite fields if two schemas share the same key name. If a service accidentally composes two schemas that both define the same env var (e.g., two schemas both defining `DATABASE_URL`), the later one wins with no error. This can cause subtle config validation bugs where a stricter validator is replaced by a looser one.
**Fix:** Add a collision check before assigning:
```typescript
for (const schema of schemas) {
  for (const key of Object.keys(schema.shape)) {
    if (key in merged) {
      throw new Error(`composeSchemas: duplicate key "${key}" detected`);
    }
  }
  Object.assign(merged, schema.shape);
}
```

### WR-02: TopologySchema port fields lack positive() constraint

**File:** `packages/config/src/topology.ts:8`
**Issue:** Port fields are validated with `z.coerce.number()` only, which accepts 0, negative numbers, and non-integer values (e.g., `3.14`). A port of 0 or -1 would pass validation and cause a silent runtime failure when the service tries to bind.
**Fix:**
```typescript
shape[svc.envKeys.PORT] = z.coerce.number().int().positive();
```

### WR-03: STORAGE_PORT lacks positive() constraint

**File:** `packages/config/src/schemas/storage.ts:5`
**Issue:** `STORAGE_PORT: z.coerce.number()` accepts 0 and negative numbers. The `GrpcSchema` correctly uses `.positive()` for `GRPC_DEADLINE_MS`, and `RateLimitSchema` uses `.positive()` for its numeric fields, but `STORAGE_PORT` does not.
**Fix:**
```typescript
STORAGE_PORT: z.coerce.number().int().positive(),
```

### WR-04: GlobalEnvSchema still exported and loadGlobalConfig still available

**File:** `packages/config/src/env-schema.ts:35` and `packages/config/src/config-loader.ts:27`
**Issue:** After the config decomposition, `GlobalEnvSchema` and `loadGlobalConfig()` remain exported and usable. Since every service now composes its own schema with only the vars it needs, the global schema is dead code. If any service accidentally uses `AppConfigModule` (plain import, no `.forRoot()`) instead of `AppConfigModule.forRoot(schema)`, it will validate against the global schema -- requiring ALL env vars to be present even if the service only needs a subset. This defeats the purpose of decomposition.
**Fix:** Either deprecate with a JSDoc `@deprecated` tag and a runtime warning, or remove `loadGlobalConfig()` and the default `@Module` decorator body from `AppConfigModule` entirely now that all services have migrated to `.forRoot()`. At minimum, add a deprecation notice:
```typescript
/** @deprecated Use loadConfig(serviceSchema) instead. Will be removed after migration completes. */
export function loadGlobalConfig(): GlobalEnv {
```

## Info

### IN-01: Duplicate CORS refinement logic

**File:** `packages/config/src/env-schema.ts:35-42` and `apps/gateway/src/infrastructure/config/gateway-env.schema.ts:23-29`
**Issue:** The CORS_STRICT + CORS_ORIGINS wildcard refinement is duplicated verbatim in both the global schema and the gateway schema. Since the global schema is being superseded by per-service schemas, this is not a bug, but it means the refinement logic exists in two places with identical message strings. If the rule changes, both must be updated.
**Fix:** Extract the refinement into a shared function in the `cors.ts` schema file:
```typescript
export const CORS_REFINEMENT = {
  check: (data: { CORS_STRICT: boolean; CORS_ORIGINS: string }) =>
    !(data.CORS_STRICT && data.CORS_ORIGINS === '*'),
  message: 'CORS_ORIGINS cannot be "*" when CORS_STRICT is enabled. Specify explicit origins.',
  path: ['CORS_ORIGINS'] as const,
};
```

### IN-02: TODO comments in module destroy hooks

**File:** `apps/auth/src/auth.module.ts:24`, `apps/gateway/src/gateway.module.ts:27`, `apps/sender/src/sender.module.ts:29-30`, `apps/parser/src/parser.module.ts:29`, `apps/audience/src/audience.module.ts:29`, `apps/notifier/src/notifier.module.ts:27`
**Issue:** All six service modules have TODO comments in `onModuleDestroy()` for connection draining. These are structural placeholders from the foundation audit, noted for tracking.
**Fix:** No immediate action needed -- these are tracked cleanup items for a future phase.

### IN-03: Inconsistent Logger resolution in main.ts files

**File:** `apps/auth/src/main.ts:13`, `apps/gateway/src/main.ts:16`, `apps/notifier/src/main.ts:12`
**Issue:** Some services use `await app.resolve(Logger)` (auth, sender, parser, audience) while others use `app.get(Logger)` (gateway, notifier). `resolve()` creates a new instance per call (transient scope), while `get()` returns the singleton. For `nestjs-pino` Logger which is typically request-scoped, `resolve()` is more correct, but the inconsistency across services suggests no deliberate design choice.
**Fix:** Standardize on one approach across all services. If Logger is transient/request-scoped, use `await app.resolve(Logger)` everywhere. If it is singleton, use `app.get(Logger)` everywhere.

---

_Reviewed: 2026-04-08T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
