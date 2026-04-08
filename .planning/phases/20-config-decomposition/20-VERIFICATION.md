---
phase: 20-config-decomposition
verified: 2026-04-08T15:30:00Z
status: human_needed
score: 9/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Start a service (e.g. auth) with only its required env vars set (Topology + DATABASE_URL + LOG_LEVEL + LOG_FORMAT + GRPC_DEADLINE_MS + PROTO_DIR + port vars), omitting all others (REDIS_URL, RABBITMQ_URL, STORAGE_*, CORS_*, RATE_LIMIT_*)"
    expected: "Service boots and passes health check — Zod does not reject because AuthEnvSchema does not include those schemas"
    why_human: "Requires running Docker infrastructure and live env configuration; cannot be verified with static file analysis"
---

# Phase 20: Config Decomposition Verification Report

**Phase Goal:** Services validate only the environment variables they actually need, and adding new infrastructure concerns does not require touching a monolithic schema
**Verified:** 2026-04-08T15:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Env schema split into 8 independent Zod sub-schemas per concern, importable individually | ✓ VERIFIED | `packages/config/src/schemas/` contains 8 files: database.ts, redis.ts, rabbitmq.ts, storage.ts, logging.ts, grpc.ts, cors.ts, rate-limit.ts. All compiled to dist/schemas/. |
| 2 | GlobalEnvSchema composes sub-schemas via spread — adding a new sub-schema requires only one import + one argument | ✓ VERIFIED | `env-schema.ts` calls `composeSchemas(TopologySchema, DatabaseSchema, RedisSchema, RabbitSchema, StorageSchema, LoggingSchema, GrpcSchema, CorsSchema, RateLimitSchema)`. Old monolithic `InfrastructureSchema` deleted. |
| 3 | Each service validates only the env vars relevant to its imported infrastructure modules | ? UNCERTAIN | Structurally true: each service schema file imports only its needed sub-schemas (verified). Runtime isolation requires human testing with partial env sets. |
| 4 | Adding a new env var group requires creating one file in schemas/ without modifying existing schemas | ✓ VERIFIED | Architecture confirmed: `composeSchemas()` accepts variadic schemas; adding a new sub-schema is a new file + one import line in `env-schema.ts` or the service schema. No existing file modification required. |
| 5 | 8 sub-schema files exist, each exporting a named ZodObject and inferred type | ✓ VERIFIED | All 8 files exist and contain `export const XxxSchema = z.object({...})` and `export type XxxConfig = z.infer<typeof XxxSchema>`. No `.default()`, `.optional()`, or `.refine()` in any sub-schema. |
| 6 | `composeSchemas()` merges N sub-schemas into a single ZodObject via shape spread | ✓ VERIFIED | `compose.ts` implements type-safe `MergeShapes<T>` recursive generic. Compiled `compose.js` exports `composeSchemas` as function (runtime verified). |
| 7 | `loadConfig(schema)` accepts any composed schema and validates process.env against it | ✓ VERIFIED | `config-loader.ts` exports generic `loadConfig<T extends z.ZodType>(schema: T): z.infer<T>` with Map-based cache. Runtime verified: `typeof loadConfig === 'function'`. |
| 8 | `AppConfigModule.forRoot(schema)` accepts a ZodObject and wires it into NestJS ConfigModule | ✓ VERIFIED | `app-config.module.ts` has static `forRoot(schema: z.ZodType): DynamicModule`. Runtime verified: `typeof AppConfigModule.forRoot === 'function'`. |
| 9 | All 6 services use per-service schemas in main.ts and root modules | ✓ VERIFIED | All 6 `main.ts` files import their `XxxEnvSchema` and call `loadConfig(XxxEnvSchema) as XxxEnv`. All 6 root modules call `AppConfigModule.forRoot(XxxEnvSchema)`. No `loadGlobalConfig` in any app. |
| 10 | Gateway validates CORS+RateLimit but not Database/Redis; Notifier validates RabbitMQ+Storage but not gRPC | ✓ VERIFIED | `GatewayEnvSchema` = Topology+Logging+gRPC+CORS+RateLimit (no Database/Redis/RabbitMQ/Storage). `NotifierEnvSchema` = Topology+RabbitMQ+Storage+Logging (no gRPC confirmed — no GrpcSchema import). |

**Score:** 9/10 truths verified (1 requires human runtime confirmation)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/config/src/schemas/database.ts` | DatabaseSchema with DATABASE_URL | ✓ VERIFIED | `z.string().url()` — no defaults/optionals |
| `packages/config/src/schemas/redis.ts` | RedisSchema with REDIS_URL | ✓ VERIFIED | `z.string().min(1)` |
| `packages/config/src/schemas/rabbitmq.ts` | RabbitSchema with RABBITMQ_URL | ✓ VERIFIED | `z.string().min(1)` |
| `packages/config/src/schemas/storage.ts` | StorageSchema with STORAGE_* fields | ✓ VERIFIED | 6 fields including `z.coerce.number()` for STORAGE_PORT (skill-allowed) |
| `packages/config/src/schemas/logging.ts` | LoggingSchema with LOG_LEVEL, LOG_FORMAT | ✓ VERIFIED | Imports from `../env-constants` (no magic values) |
| `packages/config/src/schemas/grpc.ts` | GrpcSchema with GRPC_DEADLINE_MS, PROTO_DIR | ✓ VERIFIED | Both fields present |
| `packages/config/src/schemas/cors.ts` | CorsSchema with CORS_ORIGINS, CORS_STRICT (no refine) | ✓ VERIFIED | No `.refine()` in sub-schema; refine applied after composition in gateway-env.schema.ts |
| `packages/config/src/schemas/rate-limit.ts` | RateLimitSchema with RATE_LIMIT_* fields | ✓ VERIFIED | 4 fields with `.coerce.number().positive()` |
| `packages/config/src/compose.ts` | composeSchemas() utility | ✓ VERIFIED | Type-safe MergeShapes<T> generic; compiled and runtime-verified as function |
| `packages/config/src/config-loader.ts` | loadConfig(schema) — generic config loading | ✓ VERIFIED | Also retains `loadGlobalConfig()` as backward-compat wrapper (no app uses it) |
| `packages/config/src/app-config.module.ts` | AppConfigModule.forRoot(schema) static factory | ✓ VERIFIED | Also retains plain `@Module` decorator for compat; forRoot() is the active path for all apps |
| `apps/auth/src/infrastructure/config/auth-env.schema.ts` | AuthEnvSchema: Topology+Database+Logging+gRPC | ✓ VERIFIED | Exact match |
| `apps/gateway/src/infrastructure/config/gateway-env.schema.ts` | GatewayEnvSchema with CORS refine | ✓ VERIFIED | BaseGatewayEnvSchema.refine() present |
| `apps/sender/src/infrastructure/config/sender-env.schema.ts` | SenderEnvSchema: Topology+Database+Redis+Logging+gRPC | ✓ VERIFIED | RedisSchema present |
| `apps/parser/src/infrastructure/config/parser-env.schema.ts` | ParserEnvSchema: Topology+Database+Storage+Logging+gRPC | ✓ VERIFIED | StorageSchema present |
| `apps/audience/src/infrastructure/config/audience-env.schema.ts` | AudienceEnvSchema: Topology+Database+RabbitMQ+Logging+gRPC | ✓ VERIFIED | RabbitSchema present |
| `apps/notifier/src/infrastructure/config/notifier-env.schema.ts` | NotifierEnvSchema: Topology+RabbitMQ+Storage+Logging (no gRPC) | ✓ VERIFIED | No GrpcSchema import confirmed |

All 6 services have `infrastructure/config/index.ts` barrel exports.

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/config/src/env-schema.ts` | `packages/config/src/schemas/*.ts` | `composeSchemas()` import | ✓ WIRED | Imports all 8 schemas from `./schemas`; calls `composeSchemas()` with all 9 schemas |
| `apps/*/src/main.ts` | `apps/*/src/infrastructure/config/*-env.schema.ts` | `loadConfig(XxxEnvSchema)` | ✓ WIRED | All 6 main.ts files verified |
| `apps/*/src/*.module.ts` | `apps/*/src/infrastructure/config/*-env.schema.ts` | `AppConfigModule.forRoot(XxxEnvSchema)` | ✓ WIRED | All 6 root modules verified |
| `packages/config/src/index.ts` | `./compose`, `./schemas` | `export *` | ✓ WIRED | Both re-exported; `composeSchemas` accessible as `@email-platform/config` export |
| `packages/config/src/index.ts` | `./infrastructure` | — | ✓ DELETED | No `export * from './infrastructure'` — superseded by schemas/ barrel |

### Data-Flow Trace (Level 4)

Not applicable — this phase produces configuration infrastructure (schemas, utilities, NestJS modules), not components that render dynamic data. The data flow is: process.env → Zod parse → typed config object → NestJS ConfigService DI. This is verified structurally.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| composeSchemas is a callable function | `node -e "const m=require('dist/compose.js'); console.log(typeof m.composeSchemas)"` | `function` | ✓ PASS |
| loadConfig is a callable function | `node -e "const m=require('dist/config-loader.js'); console.log(typeof m.loadConfig)"` | `function` | ✓ PASS |
| AppConfigModule.forRoot is a callable function | `node -e "const m=require('dist/app-config.module.js'); console.log(typeof m.AppConfigModule.forRoot)"` | `function` | ✓ PASS |
| dist/schemas/ contains all 8 compiled sub-schemas | `ls dist/schemas/` | 8 schema JS files present | ✓ PASS |
| Runtime env isolation (per-service schema rejects wrong vars) | Requires running service with partial env | N/A | ? SKIP — human needed |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CFG-01 | Plan 01 | Env schema разбита на модульные Zod sub-schemas per concern | ✓ SATISFIED | 8 sub-schema files in packages/config/src/schemas/ — each a standalone importable ZodObject |
| CFG-02 | Plan 01 | Sub-schemas compose в GlobalEnvSchema через spread | ✓ SATISFIED | env-schema.ts calls composeSchemas() with all 9 schemas; CORS refine applied post-composition |
| CFG-03 | Plan 02 | Каждый сервис валидирует только свои env vars, не все | ✓ SATISFIED (code) / ? RUNTIME | Per-service schemas verified statically; runtime isolation needs human test |
| CFG-04 | Plan 01 | Добавление нового env var не требует изменения монолитной схемы | ✓ SATISFIED | composeSchemas() variadic design means new schema = new file + one line; verified by architecture |

All 4 requirements (CFG-01, CFG-02, CFG-03, CFG-04) are accounted for in Plans 01 and 02. No orphaned requirements.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `packages/config/src/config-loader.ts` | `loadGlobalConfig()` retained as backward-compat wrapper | ℹ️ Info | No app calls it; exists for migration safety. No stub — it calls `loadConfig(GlobalEnvSchema)`. Harmless. |
| `packages/config/src/app-config.module.ts` | Default `@Module` decorator retained alongside `forRoot()` | ℹ️ Info | No app uses plain import; all use forRoot(). Retained by Plan 01's intentional backward-compat decision. |

No blocking anti-patterns. No placeholders, stubs, or hardcoded empty returns found in any schema or wiring file.

### Human Verification Required

#### 1. Per-Service Env Isolation at Runtime

**Test:** Start a service (e.g. auth) with only its required env vars set, deliberately omitting env vars from other schemas (e.g., omit REDIS_URL, RABBITMQ_URL, STORAGE_*, CORS_*, RATE_LIMIT_*). Provide only: topology vars (AUTH_PORT, GATEWAY_PORT, etc.), DATABASE_URL, LOG_LEVEL, LOG_FORMAT, GRPC_DEADLINE_MS, PROTO_DIR.

**Expected:** Service starts successfully and health check passes. Zod does not throw a validation error for the missing non-required vars because `AuthEnvSchema` does not include `RedisSchema`, `RabbitSchema`, etc.

**Why human:** Requires live Docker infrastructure (PostgreSQL, env file configuration) to run the service at boot. Cannot be determined from static file analysis alone — the Zod parse happens at runtime against `process.env`.

### Gaps Summary

No gaps. All structural artifacts exist, are substantive, and are correctly wired. The one uncertain item (runtime env isolation) is the core behavioral promise of the phase and requires human confirmation — hence status is `human_needed` rather than `passed`.

---

_Verified: 2026-04-08T15:30:00Z_
_Verifier: Claude (gsd-verifier)_
