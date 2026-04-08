---
phase: 20-config-decomposition
plan: 01
subsystem: config
tags: [zod, schema-composition, env-validation, nestjs-config]

# Dependency graph
requires:
  - phase: 02-configuration-management
    provides: GlobalEnvSchema, loadGlobalConfig, AppConfigModule
provides:
  - 8 modular Zod sub-schemas per concern (database, redis, rabbitmq, storage, logging, grpc, cors, rate-limit)
  - composeSchemas() utility for merging ZodObject schemas with type preservation
  - loadConfig(schema) generic config loading API
  - AppConfigModule.forRoot(schema) parameterized NestJS config wiring
affects: [20-config-decomposition plan 02, all apps consuming config]

# Tech tracking
tech-stack:
  added: []
  patterns: [schema-per-concern, composable-zod-schemas, parameterized-config-module]

key-files:
  created:
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
  modified:
    - packages/config/src/env-schema.ts
    - packages/config/src/config-loader.ts
    - packages/config/src/app-config.module.ts
    - packages/config/src/index.ts

key-decisions:
  - "Kept loadGlobalConfig() and default AppConfigModule for backward compatibility -- apps migrate in Plan 02"
  - "Manual GlobalEnv type instead of z.infer because TopologySchema has dynamic shape"
  - "composeSchemas() uses recursive MergeShapes type for field-level inference preservation"

patterns-established:
  - "Schema-per-concern: one file per env var group in packages/config/src/schemas/"
  - "No .refine() on sub-schemas -- apply after composition"
  - "composeSchemas() for merging multiple ZodObject schemas into one"

requirements-completed: [CFG-01, CFG-02, CFG-04]

# Metrics
duration: 4min
completed: 2026-04-08
---

# Phase 20 Plan 01: Config Schema Decomposition Summary

**8 modular Zod sub-schemas with composeSchemas() utility, loadConfig(schema) API, and AppConfigModule.forRoot(schema) -- backward compatible with existing apps**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-08T14:39:37Z
- **Completed:** 2026-04-08T14:44:02Z
- **Tasks:** 2
- **Files modified:** 15 (9 created, 5 modified, 1 deleted)

## Accomplishments
- Created 8 modular sub-schema files extracting fields from monolithic GlobalEnvSchema and InfrastructureSchema
- Built type-safe composeSchemas() utility that preserves field-level type inference via recursive MergeShapes generic
- Rewrote GlobalEnvSchema to use composeSchemas() with all 9 schemas (Topology + 8 sub-schemas)
- Added loadConfig(schema) with Map-based cache and AppConfigModule.forRoot(schema) static factory
- Deleted infrastructure.ts (superseded by per-concern schemas)
- Full monorepo builds (all 6 apps + 3 packages)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create 8 sub-schema files** - `ff1ed9d` (feat)
2. **Task 2: composeSchemas(), refactor config-loader/AppConfigModule, rewrite GlobalEnvSchema** - `32a2886` (feat)

## Files Created/Modified
- `packages/config/src/schemas/database.ts` - DatabaseSchema with DATABASE_URL
- `packages/config/src/schemas/redis.ts` - RedisSchema with REDIS_URL
- `packages/config/src/schemas/rabbitmq.ts` - RabbitSchema with RABBITMQ_URL
- `packages/config/src/schemas/storage.ts` - StorageSchema with STORAGE_* fields
- `packages/config/src/schemas/logging.ts` - LoggingSchema with LOG_LEVEL, LOG_FORMAT
- `packages/config/src/schemas/grpc.ts` - GrpcSchema with GRPC_DEADLINE_MS, PROTO_DIR
- `packages/config/src/schemas/cors.ts` - CorsSchema with CORS_ORIGINS, CORS_STRICT
- `packages/config/src/schemas/rate-limit.ts` - RateLimitSchema with RATE_LIMIT_* fields
- `packages/config/src/schemas/index.ts` - Barrel re-exports all schemas and types
- `packages/config/src/compose.ts` - composeSchemas() utility with type-safe MergeShapes
- `packages/config/src/env-schema.ts` - GlobalEnvSchema rewritten via composeSchemas()
- `packages/config/src/config-loader.ts` - loadConfig(schema) + loadGlobalConfig() compat wrapper
- `packages/config/src/app-config.module.ts` - forRoot(schema) + default module for compat
- `packages/config/src/index.ts` - Added schemas/ and compose exports, removed infrastructure
- `packages/config/src/infrastructure.ts` - Deleted (superseded)

## Decisions Made
- Kept loadGlobalConfig() as thin wrapper calling loadConfig(GlobalEnvSchema) for backward compatibility. All 6 apps use it in main.ts. Migration to per-service schemas is Plan 02's scope.
- Kept default AppConfigModule @Module decorator for backward compatibility. All 6 app modules import AppConfigModule without .forRoot(). Migration is Plan 02's scope.
- Used manual GlobalEnv type (intersection of sub-config types + GlobalTopology) instead of z.infer because TopologySchema builds its shape dynamically via buildTopologyShape() -- TypeScript cannot resolve dynamic record keys at the type level.
- composeSchemas() return type uses recursive MergeShapes<T> to preserve per-schema field types through composition, avoiding the loss of type information from ZodRawShape.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Kept backward-compatible loadGlobalConfig() and default AppConfigModule**
- **Found during:** Task 2 (config-loader and AppConfigModule refactor)
- **Issue:** Plan said to remove loadGlobalConfig and make AppConfigModule static-only, but all 6 apps import these. Removing would break pnpm build (plan's own verification).
- **Fix:** Kept loadGlobalConfig() as wrapper around loadConfig(GlobalEnvSchema). Kept default @Module decorator on AppConfigModule alongside new forRoot(). Plan objective explicitly states "both old API and new API".
- **Files modified:** packages/config/src/config-loader.ts, packages/config/src/app-config.module.ts
- **Verification:** pnpm build succeeds with all 6 apps
- **Committed in:** 32a2886

**2. [Rule 1 - Bug] Fixed composeSchemas() return type for type preservation**
- **Found during:** Task 2 (build verification)
- **Issue:** Original composeSchemas() returned z.ZodObject<ZodRawShape>, losing all field type info. This caused notifier's config.NOTIFIER_PORT to resolve as `unknown`, breaking app.listen() call.
- **Fix:** Added recursive MergeShapes<T> generic type that intersects all schema shapes. Also used manual GlobalEnv type since TopologySchema has dynamic shape.
- **Files modified:** packages/config/src/compose.ts, packages/config/src/env-schema.ts
- **Verification:** pnpm build succeeds, all apps compile with proper types
- **Committed in:** 32a2886

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correctness. Backward compatibility preserves plan objective of incremental migration. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All sub-schemas, composeSchemas(), loadConfig(), and AppConfigModule.forRoot() are ready
- Plan 02 can now migrate each app to per-service composed schemas using these building blocks
- Each service will compose only the schemas it needs (e.g., auth needs TopologySchema + DatabaseSchema + GrpcSchema + LoggingSchema)

---
*Phase: 20-config-decomposition*
*Completed: 2026-04-08*
