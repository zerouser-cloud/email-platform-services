# Phase 20: Config Decomposition - Research

**Researched:** 2026-04-08
**Domain:** Zod schema composition, NestJS config module, monorepo env validation
**Confidence:** HIGH

## Summary

This phase decomposes the monolithic `GlobalEnvSchema` into per-concern Zod sub-schemas so each service validates only the env vars it needs. The existing codebase already uses the spread composition pattern (`...TopologySchema.shape`, `...InfrastructureSchema.shape`) proving the approach works with Zod 4.3.6. The work is a pure refactor of `packages/config/` internals plus per-service config wiring in `apps/*/src/infrastructure/config/`.

The current `InfrastructureSchema` bundles DATABASE_URL, REDIS_URL, RABBITMQ_URL, and all STORAGE_* vars into one object. Every service validates ALL of these even though notifier uses none of them (no DB) and gateway uses none of them (no direct infra). The decomposition splits this into independent files and gives each service a composed schema containing only its actual dependencies.

**Primary recommendation:** Use `z.object({ ...SchemaA.shape, ...SchemaB.shape })` for composition (already proven in codebase), convert `AppConfigModule` to accept a schema parameter via `forRoot(schema)`, and migrate all 6 services to explicit per-service schemas.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Per-concern granularity: one file = one backing service or cross-cutting concern
- **D-02:** InfrastructureSchema replaced by individual files in `packages/config/src/schemas/`:
  - `database.ts` -> DatabaseSchema (DATABASE_URL)
  - `redis.ts` -> RedisSchema (REDIS_URL)
  - `rabbitmq.ts` -> RabbitSchema (RABBITMQ_URL)
  - `storage.ts` -> StorageSchema (STORAGE_*)
  - `logging.ts` -> LoggingSchema (LOG_LEVEL, LOG_FORMAT)
  - `grpc.ts` -> GrpcSchema (GRPC_DEADLINE_MS, PROTO_DIR)
  - `cors.ts` -> CorsSchema (CORS_ORIGINS, CORS_STRICT + refine)
  - `rate-limit.ts` -> RateLimitSchema (RATE_LIMIT_*)
- **D-03:** TopologySchema stays as-is (already separate file)
- **D-04:** Each service explicitly composes needed schemas in `apps/*/src/infrastructure/config/`
- **D-05:** Infrastructure layer knows backing services, app/domain get values via DI (ConfigService)
- **D-06:** `AppConfigModule.forRoot(schema)` accepts composed schema instead of hardcoded GlobalEnvSchema
- **D-07:** `composeSchemas()` utility in config package for merging Zod sub-schemas via spread
- **D-08:** DI contract unchanged -- ConfigService inject stays, downstream unaware of decomposition
- **D-09:** `loadGlobalConfig()` replaced by `loadConfig(schema)` accepting composed schema
- **D-10:** Existing env var names preserved: STORAGE_*, REDIS_URL, RABBITMQ_URL, DATABASE_URL
- **D-11:** New concerns: TRACING_*, CIRCUIT_BREAKER_*
- **D-12:** MINIO_ROOT_USER/PASSWORD are internal MinIO container vars, not part of application

### Claude's Discretion
- Exact signature and implementation of `composeSchemas()` (spread vs merge vs z.intersection)
- Type export structure (separate types per schema vs unified)
- Migration order (all at once vs one by one)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CFG-01 | Env schema split into modular Zod sub-schemas per concern | D-02 defines exact split: 8 sub-schema files in `packages/config/src/schemas/`. Zod 4.3.6 `.shape` spread verified working. |
| CFG-02 | Sub-schemas compose in GlobalEnvSchema via spread | Existing pattern `...TopologySchema.shape` already works. `composeSchemas()` utility wraps this (D-07). |
| CFG-03 | Each service validates only its own env vars | D-04/D-06: per-service composed schemas in `apps/*/src/infrastructure/config/`, `AppConfigModule.forRoot(schema)`. |
| CFG-04 | Adding new env var group requires only one sub-schema file | Architecture ensures new file in `schemas/` + one import line in consuming services. No existing file changes. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **No defaults/optionals in env schemas** -- every Zod field required, no `.default()`, no `.optional()`, no `z.coerce.boolean()`. Use `z.string().transform(v => v === 'true')` for booleans.
- **No magic values** -- extract to named `as const` objects in `*-constants.ts`
- **No environment branching** -- no NODE_ENV reads, app consumes config values
- **12-Factor** -- all config via `@email-platform/config`, no direct `process.env` except in config-loader
- **No infrastructure changes without user approval** -- ports, docker-compose, .env files unchanged
- **Clean/Hexagonal architecture in apps/** -- infrastructure knows backing services, domain stays pure
- **Layer dependency**: contracts -> config -> foundation -> apps

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | 4.3.6 | Schema validation and composition | Already in use, `.shape` spread works for composition [VERIFIED: pnpm lockfile + runtime test] |
| @nestjs/config | 4.0.3 | NestJS ConfigModule DI integration | Already in use, `ConfigModule.forRoot({ load: [...] })` pattern [VERIFIED: app-config.module.ts] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `.shape` spread | `z.merge()` | Merge creates new ZodObject, more allocations but cleaner API. Both work in Zod 4. [VERIFIED: runtime test] |
| `.shape` spread | `z.intersection()` | Intersection produces ZodIntersection type, harder to `.refine()`. Not suitable. [VERIFIED: runtime test] |
| `.shape` spread | `.extend()` | Extend only works A.extend(B.shape), chainable but less clear for N schemas. [VERIFIED: runtime test] |

**Recommendation for `composeSchemas()`:** Use `.shape` spread (`z.object({ ...A.shape, ...B.shape })`). This is the existing pattern in the codebase and produces a flat `ZodObject` that supports `.refine()`. [VERIFIED: existing env-schema.ts uses this pattern]

## Architecture Patterns

### Recommended Project Structure
```
packages/config/src/
  schemas/                  # NEW: per-concern sub-schemas
    database.ts             # DatabaseSchema
    redis.ts                # RedisSchema
    rabbitmq.ts             # RabbitSchema
    storage.ts              # StorageSchema
    logging.ts              # LoggingSchema
    grpc.ts                 # GrpcSchema
    cors.ts                 # CorsSchema
    rate-limit.ts           # RateLimitSchema
    index.ts                # barrel export all schemas + types
  compose.ts                # NEW: composeSchemas() utility
  config-loader.ts          # MODIFIED: loadConfig(schema) replaces loadGlobalConfig()
  app-config.module.ts      # MODIFIED: AppConfigModule.forRoot(schema)
  env-schema.ts             # MODIFIED: GlobalEnvSchema uses composeSchemas()
  topology.ts               # UNCHANGED
  infrastructure.ts         # DELETED after migration
  index.ts                  # MODIFIED: export new schemas + compose

apps/*/src/
  infrastructure/
    config/                 # NEW: per-service config composition
      service-env.schema.ts # Composed schema for this service
      index.ts              # barrel
```

### Pattern 1: Sub-Schema Definition
**What:** Each sub-schema file exports a Zod object and its inferred type
**When to use:** For every backing service or cross-cutting concern
```typescript
// packages/config/src/schemas/database.ts
import { z } from 'zod';

export const DatabaseSchema = z.object({
  DATABASE_URL: z.string().url(),
});

export type DatabaseConfig = z.infer<typeof DatabaseSchema>;
```

### Pattern 2: Schema Composition Utility
**What:** `composeSchemas()` merges N sub-schemas into one via shape spread
**When to use:** In per-service config and in GlobalEnvSchema
```typescript
// packages/config/src/compose.ts
import { z, type ZodObject, type ZodRawShape } from 'zod';

export function composeSchemas<T extends ZodObject<ZodRawShape>[]>(
  ...schemas: T
): ZodObject</* merged shape */> {
  const merged: ZodRawShape = {};
  for (const schema of schemas) {
    Object.assign(merged, schema.shape);
  }
  return z.object(merged);
}
```
[ASSUMED: exact generic signature -- Zod 4 types may need adjustment]

### Pattern 3: Per-Service Schema
**What:** Each service composes only the sub-schemas it needs
**When to use:** In `apps/*/src/infrastructure/config/`
```typescript
// apps/auth/src/infrastructure/config/auth-env.schema.ts
import { composeSchemas, TopologySchema, DatabaseSchema, LoggingSchema, GrpcSchema } from '@email-platform/config';

export const AuthEnvSchema = composeSchemas(
  TopologySchema,
  DatabaseSchema,
  LoggingSchema,
  GrpcSchema,
);

export type AuthEnv = z.infer<typeof AuthEnvSchema>;
```

### Pattern 4: AppConfigModule.forRoot(schema)
**What:** Static factory accepts schema, passes to loadConfig()
**When to use:** In every service root module
```typescript
// packages/config/src/app-config.module.ts
import { Module, type DynamicModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { loadConfig } from './config-loader';
import type { ZodObject, ZodRawShape } from 'zod';

@Module({})
export class AppConfigModule {
  static forRoot(schema: ZodObject<ZodRawShape>): DynamicModule {
    return {
      module: AppConfigModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => loadConfig(schema)],
          ignoreEnvFile: true,
          cache: true,
        }),
      ],
      exports: [ConfigModule],
    };
  }
}
```

### Pattern 5: loadConfig(schema)
**What:** Generic config loader that validates process.env against any composed schema
**When to use:** Replaces loadGlobalConfig()
```typescript
// packages/config/src/config-loader.ts
import type { ZodObject, ZodRawShape } from 'zod';

const cache = new Map<string, unknown>();

export function loadConfig<T extends ZodObject<ZodRawShape>>(schema: T): z.infer<T> {
  const cacheKey = Object.keys(schema.shape).sort().join(',');
  const cached = cache.get(cacheKey);
  if (cached) return cached as z.infer<T>;

  const result = schema.parse(process.env);
  cache.set(cacheKey, result);
  return result as z.infer<T>;
}
```

### Anti-Patterns to Avoid
- **Importing all sub-schemas in every service:** Defeats the purpose. Each service must only import what it uses.
- **Using `.optional()` on sub-schema fields:** Violates env-schema skill. Every var required.
- **Creating per-service `.env` files with different keys:** All `.env` files must have ALL keys. Only validation is per-service.
- **Reading process.env directly in service code:** All env access via ConfigService DI.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema merge | Manual object spreading in every service | `composeSchemas()` utility | Consistent pattern, type inference |
| Config loading | Custom parsers per service | `loadConfig(schema)` | Caching, error formatting, single pattern |
| DI config wiring | Custom providers per service | `AppConfigModule.forRoot(schema)` | NestJS ConfigModule handles DI, global scope |

## Common Pitfalls

### Pitfall 1: Refine Lost on Spread
**What goes wrong:** `.refine()` callbacks on sub-schemas are lost when spreading `.shape`
**Why it happens:** `.shape` is the raw ZodRawShape object, not the refined schema. Refines are a wrapper around ZodObject, not part of the shape.
**How to avoid:** Apply `.refine()` AFTER composition in the consuming service schema, not on the sub-schema itself. CorsSchema should export the base object; the CORS_STRICT/CORS_ORIGINS refine should be applied in the gateway's composed schema.
**Warning signs:** Sub-schema file has `.refine()` -- it will be silently dropped.

### Pitfall 2: Cache Invalidation in loadConfig
**What goes wrong:** Multiple calls with different schemas return cached result from first call
**Why it happens:** Current `loadGlobalConfig()` uses a single variable cache. New `loadConfig()` needs schema-aware caching.
**How to avoid:** Cache by schema identity (shape keys or schema reference).
**Warning signs:** Second service in same process gets wrong config (unlikely in microservices, possible in tests).

### Pitfall 3: Breaking main.ts bootstrap
**What goes wrong:** `loadGlobalConfig()` is called before NestJS module init in main.ts for port/proto config
**Why it happens:** main.ts needs port values before app.create(). The per-service schema must include topology vars.
**How to avoid:** Per-service schema MUST include TopologySchema. The `loadConfig(schema)` call in main.ts uses the same composed schema as AppConfigModule.forRoot().
**Warning signs:** Service boots but can't read its port.

### Pitfall 4: Foundation Package Reads Config Vars
**What goes wrong:** LoggingModule and GrpcClientModule read LOG_LEVEL, LOG_FORMAT, GRPC_DEADLINE_MS, PROTO_DIR via ConfigService
**Why it happens:** Foundation modules are consumers of config but don't own schemas
**How to avoid:** Foundation modules continue reading via ConfigService.get(). The per-service schema must include the sub-schemas for whatever foundation modules the service imports (LoggingSchema for LoggingModule, GrpcSchema for GrpcClientModule).
**Warning signs:** Runtime error "config key not found" from a foundation module.

### Pitfall 5: Type Safety Loss
**What goes wrong:** `ConfigService.get<string>('KEY')` returns `string | undefined` regardless of schema
**Why it happens:** NestJS ConfigService is not Zod-aware, types are generic
**How to avoid:** This is existing behavior, not a regression. The schema guarantees values exist at boot. ConfigService.get() returns the validated value. The `!` assertion in existing code (e.g., `configService.get<number>('GRPC_DEADLINE_MS')!`) is acceptable because the schema validated it.
**Warning signs:** None -- existing pattern continues.

## Code Examples

### Current Pattern (before)
```typescript
// packages/config/src/env-schema.ts (current)
export const GlobalEnvSchema = z.object({
  ...TopologySchema.shape,
  ...InfrastructureSchema.shape,
  PROTO_DIR: z.string().min(1),
  CORS_STRICT: z.string().transform((v) => v === 'true'),
  // ... 10+ more fields
});

// apps/auth/src/main.ts (current)
const config = loadGlobalConfig(); // validates ALL env vars
```

### Target Pattern (after)
```typescript
// packages/config/src/schemas/database.ts
export const DatabaseSchema = z.object({
  DATABASE_URL: z.string().url(),
});

// packages/config/src/compose.ts
export function composeSchemas(...schemas) {
  const merged = {};
  for (const s of schemas) Object.assign(merged, s.shape);
  return z.object(merged);
}

// apps/auth/src/infrastructure/config/auth-env.schema.ts
export const AuthEnvSchema = composeSchemas(
  TopologySchema, DatabaseSchema, LoggingSchema, GrpcSchema,
);

// apps/auth/src/main.ts (after)
const config = loadConfig(AuthEnvSchema); // validates only auth's vars
```

## Service-to-Schema Mapping

Based on current module imports and config usage:

| Service | Topology | Database | Redis | RabbitMQ | Storage | Logging | gRPC | CORS | RateLimit |
|---------|----------|----------|-------|----------|---------|---------|------|------|-----------|
| gateway | YES | no | no | no | no | YES | YES (client) | YES | YES |
| auth | YES | YES | no | no | no | YES | YES | no | no |
| sender | YES | YES | YES* | no | no | YES | YES | no | no |
| parser | YES | YES | no | no | YES* | YES | YES | no | no |
| audience | YES | YES | no | YES* | no | YES | YES | no | no |
| notifier | YES | no | no | YES* | YES* | YES | no | no | no |

*Marked items = health indicator stubs or planned future use. Include in schema now since env vars already exist in `.env` files.

[VERIFIED: from reading all 6 service modules and their imports]

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None currently configured |
| Config file | none |
| Quick run command | `pnpm --filter @email-platform/config build` (typecheck validates schemas) |
| Full suite command | `pnpm build` (builds all packages + apps, catches type/import errors) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CFG-01 | Sub-schemas parse correctly | smoke | `pnpm --filter @email-platform/config build` | N/A (type-level) |
| CFG-02 | GlobalEnvSchema composes via spread | smoke | `pnpm --filter @email-platform/config build` | N/A (type-level) |
| CFG-03 | Per-service schema validates only its vars | manual | Boot service with subset of env vars | no |
| CFG-04 | New sub-schema requires no existing file changes | manual | Add dummy schema, verify no edits needed | no |

### Sampling Rate
- **Per task commit:** `pnpm --filter @email-platform/config build && pnpm build`
- **Per wave merge:** `pnpm build` (full monorepo build)
- **Phase gate:** Full build green + all 6 services boot with health check

### Wave 0 Gaps
- No unit test framework configured (out of scope per CLAUDE.md: "tests -- separate milestone")
- Build-level validation is the primary check for this phase
- Manual verification: boot each service to confirm config loads

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Zod 3 `.merge()` returns ZodObject | Zod 4 `.merge()` also returns ZodObject | Zod 4.0 (2025) | Both spread and merge work identically [VERIFIED: runtime] |
| @nestjs/config `load` accepts function array | Same API in v4.0.3 | Stable | `load: [() => loadConfig(schema)]` works |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `composeSchemas()` generic return type can be properly inferred by TypeScript | Architecture Patterns | LOW -- fallback to explicit type assertion |
| A2 | Cache by shape-key-join is sufficient for `loadConfig()` deduplication | Pitfalls | LOW -- microservices run one schema per process, cache mostly for idempotency |
| A3 | Notifier needs RabbitMQ + Storage schemas based on planned usage | Service-to-Schema Mapping | LOW -- worst case is validating an extra var that exists in .env anyway |

## Open Questions

1. **CorsSchema refine placement**
   - What we know: Current CORS_STRICT/CORS_ORIGINS refine is on GlobalEnvSchema. Refines are lost on `.shape` spread.
   - What's unclear: Should the refine live in CorsSchema (requiring custom compose logic) or in gateway's composed schema?
   - Recommendation: Apply refine in gateway's composed schema only. CorsSchema exports base fields. This is simpler and aligns with the principle that cross-field validation belongs to the consumer.

2. **loadGlobalConfig() backward compat during migration**
   - What we know: All 6 main.ts files call `loadGlobalConfig()`. Migration needs to be atomic or have a transition.
   - What's unclear: Keep `loadGlobalConfig()` as a convenience wrapper or remove it?
   - Recommendation: Keep `loadGlobalConfig()` as `loadConfig(GlobalEnvSchema)` wrapper during migration, deprecate after all services migrated. Alternatively, migrate all 6 at once (they're each a 3-line change).

## Sources

### Primary (HIGH confidence)
- `packages/config/src/env-schema.ts` -- existing spread composition pattern verified
- `packages/config/src/infrastructure.ts` -- current monolithic schema structure
- `packages/config/src/config-loader.ts` -- current caching pattern
- `packages/config/src/app-config.module.ts` -- current AppConfigModule (no forRoot)
- All 6 `apps/*/src/main.ts` -- current loadGlobalConfig() usage
- All 6 `apps/*/src/*.module.ts` -- current module imports (determines schema needs)
- `.agents/skills/env-schema/SKILL.md` -- strict validation rules
- Runtime Zod 4.3.6 test -- `.shape` spread, `.extend()`, `.merge()` all work

### Secondary (MEDIUM confidence)
- None needed -- all findings from codebase analysis

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Zod 4.3.6 spread verified via runtime test, existing pattern in codebase
- Architecture: HIGH -- follows existing patterns (PersistenceModule, TopologySchema spread), all decisions locked
- Pitfalls: HIGH -- identified from reading actual code (refine loss, cache, foundation reads)

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (stable domain, no external dependencies)
