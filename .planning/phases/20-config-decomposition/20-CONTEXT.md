# Phase 20: Config Decomposition - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Split monolithic env-schema into modular Zod sub-schemas per concern. Each service validates only its own env vars through explicit composition in its infrastructure layer. Adding new infrastructure concerns requires no changes to existing schemas.

</domain>

<decisions>
## Implementation Decisions

### Sub-schema Granularity
- **D-01:** Per-concern granularity: one file = one backing service or cross-cutting concern
- **D-02:** InfrastructureSchema удаляется, заменяется отдельными файлами в `packages/config/src/schemas/`:
  - `database.ts` → DatabaseSchema (DATABASE_URL)
  - `redis.ts` → RedisSchema (REDIS_URL)
  - `rabbitmq.ts` → RabbitSchema (RABBITMQ_URL)
  - `storage.ts` → StorageSchema (STORAGE_*)
  - `logging.ts` → LoggingSchema (LOG_LEVEL, LOG_FORMAT)
  - `grpc.ts` → GrpcSchema (GRPC_DEADLINE_MS, PROTO_DIR)
  - `cors.ts` → CorsSchema (CORS_ORIGINS, CORS_STRICT + refine)
  - `rate-limit.ts` → RateLimitSchema (RATE_LIMIT_*)
- **D-03:** TopologySchema остаётся как есть — уже отдельный файл

### Per-service Validation
- **D-04:** Каждый сервис явно compose нужные схемы в infrastructure layer: `apps/*/src/infrastructure/config/`
- **D-05:** Паттерн аналогичен gRPC клиентам в hexagonal — infrastructure знает backing services, application/domain получают values через DI (ConfigService)
- **D-06:** `AppConfigModule.forRoot(schema)` принимает composed-схему вместо хардкоженной GlobalEnvSchema

### Config API
- **D-07:** `composeSchemas()` — утилита в config пакете для merge Zod sub-schemas через spread
- **D-08:** DI контракт не меняется — ConfigService inject остаётся, downstream код не знает о декомпозиции
- **D-09:** `loadGlobalConfig()` заменяется на `loadConfig(schema)` — принимает composed-схему

### Env Var Naming
- **D-10:** Существующие имена сохраняются: STORAGE_*, REDIS_URL, RABBITMQ_URL, DATABASE_URL
- **D-11:** Новые concerns: TRACING_*, CIRCUIT_BREAKER_*
- **D-12:** MINIO_ROOT_USER/PASSWORD — внутренние переменные MinIO контейнера, не часть приложения

### Claude's Discretion
- Exact signature и реализация `composeSchemas()` (spread vs merge vs z.intersection)
- Структура type exports (отдельные типы per schema vs unified)
- Порядок миграции сервисов (все сразу vs по одному)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current config architecture
- `packages/config/src/env-schema.ts` — Current GlobalEnvSchema with spread composition pattern
- `packages/config/src/infrastructure.ts` — Monolithic InfrastructureSchema to be split
- `packages/config/src/topology.ts` — TopologySchema reference (keep as-is)
- `packages/config/src/config-loader.ts` — loadGlobalConfig() to be refactored
- `packages/config/src/app-config.module.ts` — AppConfigModule to gain forRoot(schema)
- `packages/config/src/index.ts` — Barrel exports to update

### Service bootstrap pattern
- `apps/auth/src/main.ts` — Reference: how services call loadGlobalConfig()
- `apps/gateway/src/main.ts` — Reference: gateway-specific config (CORS, rate limit)

### Architecture constraints
- `.agents/skills/env-schema/SKILL.md` — No defaults, no optionals in env schemas
- `.agents/skills/twelve-factor/SKILL.md` — No environment branching, no NODE_ENV
- `.agents/skills/no-magic-values/SKILL.md` — Named constants for all literals

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TopologySchema` + `InfrastructureSchema` spread pattern in `env-schema.ts` — proves compose via spread works
- `AppConfigModule` wrapping `ConfigModule.forRoot()` — wrapping pattern for forRoot(schema)

### Established Patterns
- Zod schemas with `.min(1)`, `z.coerce.number()`, `.transform()` for env validation
- Barrel exports via `index.ts` in packages/config
- `loadGlobalConfig()` caches parsed config — same caching pattern needed in new `loadConfig()`

### Integration Points
- Every `main.ts` calls `loadGlobalConfig()` — all 6 services need migration
- Every service module imports `AppConfigModule` — all need `forRoot(schema)` change
- `.env`, `.env.docker`, `.env.example` files — no changes needed (same vars, different validation)

</code_context>

<specifics>
## Specific Ideas

- Infrastructure/config/ layer в каждом сервисе — по аналогии с infrastructure/clients/ для gRPC
- PersistenceModule уже есть как reference — новый паттерн должен быть в том же стиле

</specifics>

<deferred>
## Deferred Ideas

- **CORS refine и wildcard handling** — пересмотреть подход к `.refine()` для CORS_STRICT/CORS_ORIGINS и логику `config.CORS_ORIGINS.split(',')` в gateway main.ts. Возможно упростить или убрать. Поднять при обсуждении Phase 23 (gRPC Client) или Phase 24 (HTTP Client), когда будем детально разбирать gateway.

</deferred>

---

*Phase: 20-config-decomposition*
*Context gathered: 2026-04-08*
