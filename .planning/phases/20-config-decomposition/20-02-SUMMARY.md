---
phase: 20-config-decomposition
plan: 02
subsystem: config
tags: [zod, schema-composition, env-validation, nestjs-config, per-service-schema]

# Dependency graph
requires:
  - phase: 20-config-decomposition plan 01
    provides: composeSchemas(), loadConfig(schema), AppConfigModule.forRoot(schema), 8 sub-schemas
provides:
  - 6 per-service env schemas (AuthEnvSchema, GatewayEnvSchema, SenderEnvSchema, ParserEnvSchema, AudienceEnvSchema, NotifierEnvSchema)
  - Per-service config types (AuthEnv, GatewayEnv, etc.) for type-safe bootstrap
  - All services migrated from loadGlobalConfig() to loadConfig(XxxEnvSchema)
  - All root modules migrated from AppConfigModule to AppConfigModule.forRoot(XxxEnvSchema)
affects: [all future infrastructure module plans that need env vars]

# Tech tracking
tech-stack:
  added: [zod (direct dep in all 6 apps)]
  patterns: [per-service-env-schema, manual-env-type-for-dynamic-topology, type-assertion-on-loadConfig]

key-files:
  created:
    - apps/auth/src/infrastructure/config/auth-env.schema.ts
    - apps/auth/src/infrastructure/config/index.ts
    - apps/gateway/src/infrastructure/config/gateway-env.schema.ts
    - apps/gateway/src/infrastructure/config/index.ts
    - apps/sender/src/infrastructure/config/sender-env.schema.ts
    - apps/sender/src/infrastructure/config/index.ts
    - apps/parser/src/infrastructure/config/parser-env.schema.ts
    - apps/parser/src/infrastructure/config/index.ts
    - apps/audience/src/infrastructure/config/audience-env.schema.ts
    - apps/audience/src/infrastructure/config/index.ts
    - apps/notifier/src/infrastructure/config/notifier-env.schema.ts
    - apps/notifier/src/infrastructure/config/index.ts
  modified:
    - apps/auth/src/main.ts
    - apps/auth/src/auth.module.ts
    - apps/gateway/src/main.ts
    - apps/gateway/src/gateway.module.ts
    - apps/sender/src/main.ts
    - apps/sender/src/sender.module.ts
    - apps/parser/src/main.ts
    - apps/parser/src/parser.module.ts
    - apps/audience/src/main.ts
    - apps/audience/src/audience.module.ts
    - apps/notifier/src/main.ts
    - apps/notifier/src/notifier.module.ts
    - apps/*/package.json (zod dependency added)
    - packages/config/src/index.ts

key-decisions:
  - "Added zod as direct dependency to all 6 apps to fix TS2742 cross-package type resolution"
  - "Manual XxxEnv types (GlobalTopology & sub-config intersections) because TopologySchema has dynamic shape"
  - "Type assertion (as XxxEnv) on loadConfig() calls -- same pattern as Plan 01's GlobalEnv"

patterns-established:
  - "Per-service schema: each service composes only the sub-schemas it needs via composeSchemas()"
  - "Manual env type: XxxEnv = GlobalTopology & SubConfig1 & SubConfig2 & ... for type-safe config access"
  - "Schema file location: apps/*/src/infrastructure/config/*-env.schema.ts"

requirements-completed: [CFG-03]

# Metrics
duration: 10min
completed: 2026-04-08
---

# Phase 20 Plan 02: Per-Service Config Migration Summary

**All 6 services migrated to per-service composed env schemas -- each service validates only its required env vars at boot**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-08T14:47:08Z
- **Completed:** 2026-04-08T14:57:11Z
- **Tasks:** 2
- **Files modified:** 32 (12 created, 20 modified)

## Accomplishments
- Created 6 per-service env schema files, each composing only required sub-schemas via composeSchemas()
- Gateway schema includes CORS refine validation, notifier schema excludes gRPC (no gRPC server/client)
- Migrated all 6 main.ts from loadGlobalConfig() to loadConfig(XxxEnvSchema)
- Migrated all 6 root modules from AppConfigModule to AppConfigModule.forRoot(XxxEnvSchema)
- DI contract unchanged -- all downstream ConfigService.get() calls work without modification
- Full monorepo builds (all 10 turbo tasks pass)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create per-service env schemas** - `b22a6ac` (feat)
2. **Task 2: Migrate main.ts and root modules** - `94bfc1b` (feat)

## Files Created/Modified
- `apps/auth/src/infrastructure/config/auth-env.schema.ts` - AuthEnvSchema: Topology + Database + Logging + gRPC
- `apps/gateway/src/infrastructure/config/gateway-env.schema.ts` - GatewayEnvSchema: Topology + Logging + gRPC + CORS + RateLimit (with CORS refine)
- `apps/sender/src/infrastructure/config/sender-env.schema.ts` - SenderEnvSchema: Topology + Database + Redis + Logging + gRPC
- `apps/parser/src/infrastructure/config/parser-env.schema.ts` - ParserEnvSchema: Topology + Database + Storage + Logging + gRPC
- `apps/audience/src/infrastructure/config/audience-env.schema.ts` - AudienceEnvSchema: Topology + Database + RabbitMQ + Logging + gRPC
- `apps/notifier/src/infrastructure/config/notifier-env.schema.ts` - NotifierEnvSchema: Topology + RabbitMQ + Storage + Logging (no gRPC)
- `apps/*/src/infrastructure/config/index.ts` - Barrel exports for schema and type
- `apps/*/src/main.ts` - loadConfig(XxxEnvSchema) as XxxEnv replaces loadGlobalConfig()
- `apps/*/src/*.module.ts` - AppConfigModule.forRoot(XxxEnvSchema) replaces AppConfigModule
- `apps/*/package.json` - Added zod ^4.3.6 as direct dependency
- `packages/config/src/index.ts` - Reverted z re-export (unnecessary with direct zod dep)

## Decisions Made
- Added `zod` as direct dependency to all 6 apps. Required because TypeScript TS2742 cannot resolve Zod's internal types across workspace package boundaries. Without it, exported schema const types reference non-portable paths like `../../../../../packages/config/node_modules/zod/v4/core/schemas.cjs`.
- Created manual `XxxEnv` type aliases (e.g., `AuthEnv = GlobalTopology & DatabaseConfig & LoggingConfig & GrpcConfig`) because TopologySchema uses a dynamic shape (`buildTopologyShape()` returns `Record<string, z.ZodType>`), making `z.infer` resolve all fields to `unknown`. This is the same pattern Plan 01 established with `GlobalEnv`.
- Used `as XxxEnv` type assertions on `loadConfig()` calls. The assertion is safe because the Zod schema validates the same fields at runtime -- the manual type just provides the static type information that TypeScript cannot infer from the dynamic topology shape.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added zod as direct dependency to all 6 apps**
- **Found during:** Task 1 (schema file creation)
- **Issue:** TypeScript TS2742 error: "The inferred type of 'XxxEnvSchema' cannot be named without a reference to '../packages/config/node_modules/zod/...'. This is likely not portable."
- **Fix:** Added `"zod": "^4.3.6"` to dependencies in all 6 app package.json files. Also tried explicit type annotations first but those erased field types, causing downstream `unknown` errors.
- **Files modified:** apps/*/package.json, pnpm-lock.yaml
- **Verification:** pnpm build succeeds with all 10 turbo tasks
- **Committed in:** 94bfc1b

**2. [Rule 1 - Bug] Added manual XxxEnv types and type assertions**
- **Found during:** Task 2 (main.ts migration)
- **Issue:** Even with zod as direct dep, `loadConfig(XxxEnvSchema)` returned `{ [x: string]: unknown }` because TopologySchema has dynamic shape. Fields like `config.AUTH_PORT` and `config.PROTO_DIR` resolved to `unknown`, breaking app.listen() and createGrpcServerOptions() calls.
- **Fix:** Added manual type aliases (e.g., `AuthEnv = GlobalTopology & DatabaseConfig & LoggingConfig & GrpcConfig`) and `as XxxEnv` assertions on loadConfig() calls. Same pattern as Plan 01's GlobalEnv type.
- **Files modified:** apps/*/src/infrastructure/config/*-env.schema.ts, apps/*/src/main.ts
- **Verification:** pnpm build succeeds, all field accesses properly typed
- **Committed in:** 94bfc1b

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for compilation. The zod dependency and manual types follow the exact pattern established in Plan 01 for GlobalEnvSchema/GlobalEnv. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Config decomposition complete -- each service validates only its own env vars
- Adding new env var groups to a service requires only importing one additional schema in the service's schema file
- loadGlobalConfig() still available in packages/config for backward compatibility but no app uses it
- Phase 20 complete -- ready for next infrastructure module phase (CacheModule, StorageModule, etc.)

---
*Phase: 20-config-decomposition*
*Completed: 2026-04-08*
