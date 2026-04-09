# Roadmap: Email Platform

## Milestones

- v1.0 Foundation Audit - Phases 1-8 (shipped 2026-04-04)
- v2.0 PostgreSQL + Drizzle Migration - Phases 9-14 (shipped 2026-04-04)
- v3.0 Infrastructure & CI/CD - Phases 15-19 (shipped 2026-04-08)
- v4.0 Infrastructure Abstractions & Cross-Cutting - Phases 20-27 (in progress)

## Phases

<details>
<summary>v1.0 Foundation Audit (Phases 1-8) - SHIPPED 2026-04-04</summary>

- [x] **Phase 1: Contract Consolidation** - Single source of truth for generated types, proto pipeline in Turbo
- [x] **Phase 2: Configuration Management** - One-time config load via DI, environment-aware validation
- [x] **Phase 3: Error Handling & Safety** - Metadata bug fix, safe error messages, unified error format
- [x] **Phase 4: Architecture Reference Implementation** - Auth service restructured as Clean/Hexagonal reference
- [x] **Phase 5: Architecture Replication & Boundaries** - All remaining services follow reference pattern, cross-service isolation enforced
- [x] **Phase 6: Health & Resilience** - Parallel health checks, tuned retries, liveness/readiness separation
- [x] **Phase 7: Logging, Security & Operations** - Structured logging, CORS lockdown, graceful shutdown
- [x] **Phase 8: Verification** - Full-stack smoke test: infra up, services start, health responds, gateway proxies

</details>

<details>
<summary>v2.0 PostgreSQL + Drizzle Migration (Phases 9-14) - SHIPPED 2026-04-04</summary>

- [x] **Phase 9: Config & MongoDB Cleanup** - DATABASE_URL in env-schema, purge all MongoDB references from config and code
- [x] **Phase 10: Foundation DrizzleModule & Health** - Shared DrizzleModule, DatabaseHealthIndicator DI abstraction, pool lifecycle
- [x] **Phase 11: Docker Infrastructure** - PostgreSQL 16 in docker-compose replacing MongoDB, volumes and healthchecks
- [x] **Phase 12: Auth Schema & Repository (Reference)** - Drizzle schema, migrations, repository adapter for auth as reference implementation
- [x] **Phase 13: Remaining Services Schema & Repository** - Sender, parser, audience schemas, migrations, and repository adapters following auth pattern
- [x] **Phase 14: Verification & Documentation** - All services start, health checks pass, documentation updated

</details>

<details>
<summary>v3.0 Infrastructure & CI/CD (Phases 15-19) - SHIPPED 2026-04-08</summary>

- [x] **Phase 15: Docker Compose Split & Environment** - Separate infra/services compose files, fix ports, sync env files
- [x] **Phase 16: CI Pipeline** - GitHub Actions PR validation with Turbo affected-only execution and remote cache
- [x] **Phase 16.1: Docker Port Isolation** - Infra ports only in dev-ports override, gateway-only in full Docker (INSERTED)
- [x] **Phase 17: Docker Image Build & Push** - Per-service Docker builds via matrix strategy, published to GHCR with scoped cache
- [x] **Phase 17.1: Fix DI Double Registration** - Single PG pool per service (INSERTED)
- [x] **Phase 17.2: No Magic Values Skill & Audit** - Skill creation + full codebase audit (INSERTED)
- [x] **Phase 18: Deployment via Coolify** - Coolify deployment with CI push-based deploy, Cloudflare HTTPS
- [x] **Phase 18.1: Deployment Polish** - CI deploy dedup, Garage S3 setup (INSERTED)
- [x] **Phase 19: Verification** - Both dev modes work, CI pipeline passes on clean repo

</details>

### v4.0 Infrastructure Abstractions & Cross-Cutting (In Progress)

**Milestone Goal:** Unified infrastructure abstractions -- framework modules in foundation, per-service adapters in infrastructure/ -- isolating services from infrastructure knowledge, Clean/Hexagonal style.

- [x] **Phase 20: Config Decomposition** - Modular Zod sub-schemas per concern replacing monolithic env-schema (completed 2026-04-08)
- [x] **Phase 21: Redis CacheModule** - CacheModule in foundation with DI tokens, health indicator, per-service namespace isolation (completed 2026-04-08)
- [x] **Phase 22: S3 StorageModule** - StorageModule in foundation with AWS SDK v3, unified MinIO/Garage, env rename MINIO->S3 (completed 2026-04-09)
- [ ] **Phase 23: gRPC Client Typed Wrappers** - Type-safe gRPC client framework in foundation with deadline propagation
- [ ] **Phase 24: HTTP Client & Circuit Breaker** - HTTP client framework with retry, timeout, circuit breaker for external APIs
- [ ] **Phase 25: RabbitMQ EventModule** - Publisher/consumer abstraction with manual ack, DLQ, typed event interfaces
- [ ] **Phase 26: Graceful Shutdown** - Centralized ShutdownOrchestrator managing ordered teardown of all modules
- [ ] **Phase 27: Distributed Tracing** - Correlation ID propagation through gRPC metadata and RabbitMQ headers

## Phase Details

### Phase 20: Config Decomposition
**Goal**: Services validate only the environment variables they actually need, and adding new infrastructure concerns does not require touching a monolithic schema
**Depends on**: Phase 19 (v3.0 complete)
**Requirements**: CFG-01, CFG-02, CFG-03, CFG-04
**Success Criteria** (what must be TRUE):
  1. Env schema is split into independent Zod sub-schemas per concern (redis, s3, rabbitmq, http, tracing) that can be imported individually
  2. GlobalEnvSchema composes sub-schemas via spread -- adding a new sub-schema requires only one import line
  3. Each service's config module validates only the env vars relevant to its imported infrastructure modules, not the full set
  4. A developer can add a new env var group (e.g., for a new backing service) by creating one sub-schema file without modifying existing schemas
**Plans**: 2 plans
Plans:
- [x] 20-01-PLAN.md — Create sub-schemas, composeSchemas(), refactor config-loader & AppConfigModule
- [x] 20-02-PLAN.md — Migrate all 6 services to per-service schemas

### Phase 21: Redis CacheModule
**Goal**: Services can use Redis for caching through a DI-injected client with health monitoring and namespace isolation, following the PersistenceModule pattern
**Depends on**: Phase 20
**Requirements**: CACHE-01, CACHE-02, CACHE-03, CACHE-04
**Success Criteria** (what must be TRUE):
  1. CacheModule exists in foundation with `forRootAsync()`, Symbol DI tokens, health indicator, and shutdown hook -- structurally matching PersistenceModule
  2. A service importing CacheModule can inject the Redis client via DI token and perform get/set/del operations against a running Redis instance
  3. Health endpoint reports real Redis connection status (not a stub returning "up")
  4. Keys written by different services are automatically namespaced (e.g., `auth:session:123`, `sender:rate:456`) and cannot collide
**Plans**: 2 plans
Plans:
- [x] 21-01-PLAN.md — Create CacheModule in foundation (ioredis, DI tokens, health, shutdown, namespace)
- [x] 21-02-PLAN.md — Integrate CacheModule into sender service

### Phase 22: S3 StorageModule
**Goal**: Services can store and retrieve files through a DI-injected S3 client that works identically with MinIO (local) and Garage (production) without code changes
**Depends on**: Phase 20
**Requirements**: S3-01, S3-02, S3-03, S3-04
**Success Criteria** (what must be TRUE):
  1. StorageModule exists in foundation with `forRootAsync()`, Symbol DI tokens, health indicator, and shutdown hook
  2. The same client code works against MinIO (local dev) and Garage (production) -- switching requires only env var changes, zero code changes
  3. All env vars use S3_* prefix (S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET) -- no MINIO_* references remain in codebase
  4. A service importing StorageModule can upload, download, and delete files through the injected client
**Plans**: 2 plans
Plans:
- [x] 22-01-PLAN.md — Create StorageModule + ReportsStorageModule in foundation (AWS SDK v3, DI tokens, health, shutdown)
- [x] 22-02-PLAN.md — Integrate ParserStorageModule and NotifierStorageModule, add S3 health indicators

### Phase 22.3: storage-smoke-test-endpoints (INSERTED)
**Goal**: Each storage-using service exposes safe, env-gated HTTP endpoints that exercise the full StoragePort surface for every bound bucket, enabling end-to-end runtime verification across all deployment environments
**Depends on**: Phase 22, Phase 22.1, Phase 22.2
**Requirements**: SSMK-01, SSMK-02, SSMK-03, SSMK-04, SSMK-05
**Success Criteria** (what must be TRUE):
  1. Parser exposes smoke endpoints for both PARSER_STORAGE and REPORTS_STORAGE covering upload, download, delete, exists, getSignedUrl
  2. Notifier exposes smoke endpoints for REPORTS_STORAGE covering the same StoragePort surface
  3. Cross-service shared bucket flow is demonstrably runnable: parser uploads to reports bucket, notifier downloads the same key from reports bucket -- proves shared storage works end-to-end
  4. Endpoints are gated by a required env flag (config value, no NODE_ENV/isDev/isProd reads) -- disabled by default in shipped artifacts
  5. The same endpoint contracts are reachable across all four deployment environments (local-native, local-docker, dev-Coolify, prod-Coolify) so a single test plan validates the entire matrix
**Plans**: 0 plans
Plans:
- [ ] TBD (run /gsd-plan-phase 22.3 to break down)

### Phase 22.2: bucket-provisioning-automation (INSERTED)
**Goal**: Полная процедура создания S3 bucket'ов документирована как операционный runbook, покрывающий все 4 окружения (local-native, local-isolated, dev Coolify/Garage, prod Coolify/Garage). Любой оператор может следовать runbook без предварительных знаний и получить рабочие buckets. Нулевые изменения в коде, docker-compose, env-схемах — единственный deliverable `docs/runbooks/bucket-provisioning.md`.
**Depends on**: Phase 22, Phase 22.1
**Requirements**: SPRV-01, SPRV-02, SPRV-03, SPRV-04, SPRV-05
**Scope change**: Оригинальный scope (code-based auto-provisioning с env flag) был отклонён в `/gsd:discuss-phase` 2026-04-09. Причины зафиксированы в `.planning/phases/22.2-bucket-provisioning-automation/22.2-CONTEXT.md` decisions D-01..D-03 и в Rationale секции самого runbook. Phase 22.3 prerequisite изменён: "выполнить runbook и создать buckets" вместо "auto-provisioning работает".
**Success Criteria** (what must be TRUE):
  1. `docs/runbooks/bucket-provisioning.md` существует и покрывает все 4 окружения отдельными self-contained разделами в порядке local-native → local-isolated → dev Coolify/Garage → prod Coolify/Garage
  2. Новый разработчик с нуля может следовать runbook и получить рабочие buckets в любом из 4 окружений без внешней помощи
  3. Garage секции (dev, prod) включают шаги создания key binding с подчёркнутым warning блоком — без key binding bucket недоступен приложению
  4. Каждый раздел включает `curl` verification step против `/health/ready` с примерами OK и DOWN ответов
  5. Rationale секция объясняет решение не автоматизировать (12-factor separation, Garage key bindings incompatibility, minimal prod permissions, safety против silent misconfig, unified approach)
  6. Ноль изменений в `apps/`, `packages/`, `infra/` — только в `docs/` и `.planning/`
**Plans**: 2 plans
Plans:
- [x] 22.2-01-PLAN.md — Переписать REQUIREMENTS.md/ROADMAP.md/PROJECT.md под новый docs-only scope
- [x] 22.2-02-PLAN.md — Создать docs/runbooks/bucket-provisioning.md с 4 env разделами + rationale + known gap

### Phase 22.1: s3-core-encapsulation (INSERTED)
**Goal**: Per-service composition StorageModule fully owns the S3 client lifecycle — root modules import a single storage module and have no knowledge of underlying S3 infrastructure
**Depends on**: Phase 22
**Requirements**: SENC-01, SENC-02, SENC-03, SENC-04
**Success Criteria** (what must be TRUE):
  1. parser.module.ts and notifier.module.ts each import exactly one storage-related module (the per-service composition StorageModule)
  2. S3CoreModule is imported only from within per-service composition StorageModule, never from a root service module
  3. Adding a new bucket type to an existing service requires only a new per-bucket module plus a composition update -- no changes to the root service module
  4. pnpm build remains green; all existing storage DI tokens (PARSER_STORAGE, REPORTS_STORAGE, *_STORAGE_HEALTH) still resolve correctly after refactor
**Plans**: 5 plans
Plans:
- [x] 22.1-01-PLAN.md — Create external/internal skeletons, relocate storage primitives to internal/storage/, remove @Global(), rewrite ReportsStorageModule with explicit S3CoreModule import
- [x] 22.1-02-PLAN.md — Relocate non-storage subsystems to external/, flip top-level barrel to one-line re-export, drop S3CoreModule from parser.module.ts and notifier.module.ts
- [x] 22.1-03-PLAN.md — Add exports field to foundation package.json, upgrade tsconfig.base.json to node16/node16, force rebuild
- [x] 22.1-04-PLAN.md — Rewrite parser-storage.module.ts with @email-platform/foundation/internal subpath imports, delete Plan 02 BucketStorageModule compat shim
- [x] 22.1-05-PLAN.md — Add single static ESLint rule (apps/*/src override + apps/*/src/infrastructure override), automated probe verification, human-verified boot smoke tests

### Phase 23: gRPC Client Typed Wrappers
**Goal**: Services communicate via gRPC using type-safe client wrappers that enforce proto contracts at compile time and handle deadlines automatically
**Depends on**: Phase 20
**Requirements**: GRPC-01, GRPC-02, GRPC-03, GRPC-04
**Success Criteria** (what must be TRUE):
  1. Foundation provides a gRPC client framework that binds to proto-generated TypeScript types -- calling a non-existent method or passing wrong types is a compile error
  2. Each service registers only the gRPC clients it needs (e.g., sender registers audience client but not auth client)
  3. Gateway creates typed gRPC clients for all five backend services through the same registration pattern
  4. Every gRPC call has a configurable deadline/timeout that propagates through the call chain without manual plumbing
**Plans**: 2 plans
Plans:
- [ ] 20-01-PLAN.md — Create sub-schemas, composeSchemas(), refactor config-loader & AppConfigModule
- [ ] 20-02-PLAN.md — Migrate all 6 services to per-service schemas

### Phase 24: HTTP Client & Circuit Breaker
**Goal**: Services can call external APIs through a resilient HTTP client with automatic retry, timeout, logging, and circuit breaker protection
**Depends on**: Phase 20
**Requirements**: HTTP-01, HTTP-02, HTTP-03, HTTP-04
**Success Criteria** (what must be TRUE):
  1. Foundation provides an HTTP client framework with configurable retry, timeout, and structured request/response logging
  2. Circuit breaker is integrated into the HTTP abstraction -- after N consecutive failures to an external endpoint, calls fail fast without making the request
  3. Per-service adapters exist (or can be created) for AppStoreSpy, Telegram Bot API, and Cloud Functions, each built on the shared framework
  4. Circuit breaker applies only to external HTTP calls -- internal gRPC communication is not affected by circuit breaker state
**Plans**: 2 plans
Plans:
- [ ] 20-01-PLAN.md — Create sub-schemas, composeSchemas(), refactor config-loader & AppConfigModule
- [ ] 20-02-PLAN.md — Migrate all 6 services to per-service schemas

### Phase 25: RabbitMQ EventModule
**Goal**: Services can publish and consume domain events through typed interfaces with guaranteed delivery semantics, dead letter handling, and health monitoring
**Depends on**: Phase 20
**Requirements**: EVENT-01, EVENT-02, EVENT-03, EVENT-04, EVENT-05
**Success Criteria** (what must be TRUE):
  1. EventModule exists in foundation with publisher/consumer abstraction, Symbol DI tokens, health indicator, and shutdown hook
  2. Consumed messages use manual acknowledgment by default -- a message is not removed from the queue until the handler explicitly acks it
  3. Failed messages are routed to a Dead Letter Queue without additional per-service configuration
  4. Each service declares its publishers and consumers through a declarative configuration (routing keys, exchange, queue names) without touching EventModule internals
  5. A service can publish a typed event and another service can consume it through a typed handler interface -- type mismatches are compile errors
**Plans**: 2 plans
Plans:
- [ ] 20-01-PLAN.md — Create sub-schemas, composeSchemas(), refactor config-loader & AppConfigModule
- [ ] 20-02-PLAN.md — Migrate all 6 services to per-service schemas

### Phase 26: Graceful Shutdown
**Goal**: When a service receives SIGTERM, all in-flight work completes and all connections close in the correct order before the process exits
**Depends on**: Phase 21, Phase 22, Phase 23, Phase 24, Phase 25
**Requirements**: SHUT-01, SHUT-02, SHUT-03
**Success Criteria** (what must be TRUE):
  1. A centralized ShutdownOrchestrator coordinates teardown of all registered modules in a defined order
  2. In-flight HTTP and gRPC requests complete before connections are closed -- no abrupt termination mid-request
  3. Shutdown order is enforced: stop accepting new requests, drain in-flight work, then close connections in reverse dependency order (RabbitMQ, Redis, PostgreSQL)
**Plans**: 2 plans
Plans:
- [ ] 20-01-PLAN.md — Create sub-schemas, composeSchemas(), refactor config-loader & AppConfigModule
- [ ] 20-02-PLAN.md — Migrate all 6 services to per-service schemas

### Phase 27: Distributed Tracing
**Goal**: A single correlation ID follows a request from gateway entry through all downstream gRPC calls and RabbitMQ event chains, visible in every log line
**Depends on**: Phase 23, Phase 25
**Requirements**: TRACE-01, TRACE-02, TRACE-03
**Success Criteria** (what must be TRUE):
  1. Correlation ID is automatically injected into gRPC metadata on outgoing calls and extracted on incoming calls -- no manual plumbing in service code
  2. Correlation ID is automatically injected into RabbitMQ message headers on publish and extracted on consume
  3. A request entering gateway produces logs across all downstream services (gRPC and event-driven) that share the same correlation ID
**Plans**: 2 plans
Plans:
- [ ] 20-01-PLAN.md — Create sub-schemas, composeSchemas(), refactor config-loader & AppConfigModule
- [ ] 20-02-PLAN.md — Migrate all 6 services to per-service schemas

## Progress

**Execution Order:**
Phases execute in numeric order: 20 -> 21 -> 22 -> 23 -> 24 -> 25 -> 26 -> 27

Note: Phases 21-24 depend only on Phase 20 and could theoretically run in any order, but sequential execution is recommended for pattern refinement (simplest module first).

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Contract Consolidation | v1.0 | 1/1 | Complete | 2026-04-04 |
| 2. Configuration Management | v1.0 | 3/3 | Complete | 2026-04-04 |
| 3. Error Handling & Safety | v1.0 | 2/2 | Complete | 2026-04-04 |
| 4. Architecture Reference Implementation | v1.0 | 2/2 | Complete | 2026-04-04 |
| 5. Architecture Replication & Boundaries | v1.0 | 3/3 | Complete | 2026-04-04 |
| 6. Health & Resilience | v1.0 | 3/3 | Complete | 2026-04-04 |
| 7. Logging, Security & Operations | v1.0 | 2/2 | Complete | 2026-04-04 |
| 8. Verification | v1.0 | 2/2 | Complete | 2026-04-04 |
| 9. Config & MongoDB Cleanup | v2.0 | 1/1 | Complete | 2026-04-04 |
| 10. Foundation DrizzleModule & Health | v2.0 | 1/1 | Complete | 2026-04-04 |
| 11. Docker Infrastructure | v2.0 | 1/1 | Complete | 2026-04-04 |
| 12. Auth Schema & Repository (Reference) | v2.0 | 1/1 | Complete | 2026-04-04 |
| 13. Remaining Services Schema & Repository | v2.0 | 1/1 | Complete | 2026-04-04 |
| 14. Verification & Documentation | v2.0 | 1/1 | Complete | 2026-04-04 |
| 15. Docker Compose Split & Environment | v3.0 | 1/1 | Complete | 2026-04-04 |
| 16. CI Pipeline | v3.0 | 1/1 | Complete | 2026-04-04 |
| 16.1. Docker Port Isolation | v3.0 | 1/1 | Complete | 2026-04-04 |
| 17. Docker Image Build & Push | v3.0 | 1/1 | Complete | 2026-04-04 |
| 17.1. Fix DI Double Registration | v3.0 | 1/1 | Complete | 2026-04-04 |
| 17.2. No Magic Values Skill & Audit | v3.0 | 3/3 | Complete | 2026-04-04 |
| 18. Deployment via Coolify | v3.0 | 3/3 | Complete | 2026-04-06 |
| 18.1. Deployment Polish | v3.0 | 2/2 | Complete | 2026-04-08 |
| 19. Verification | v3.0 | 0/0 | Complete | 2026-04-08 |
| 20. Config Decomposition | v4.0 | 2/2 | Complete    | 2026-04-08 |
| 21. Redis CacheModule | v4.0 | 2/2 | Complete    | 2026-04-08 |
| 22. S3 StorageModule | v4.0 | 3/3 | Complete    | 2026-04-09 |
| 23. gRPC Client Typed Wrappers | v4.0 | 0/0 | Not started | - |
| 24. HTTP Client & Circuit Breaker | v4.0 | 0/0 | Not started | - |
| 25. RabbitMQ EventModule | v4.0 | 0/0 | Not started | - |
| 26. Graceful Shutdown | v4.0 | 0/0 | Not started | - |
| 27. Distributed Tracing | v4.0 | 0/0 | Not started | - |

## Backlog

### Phase 999.1: TopologySchema Static Refactor — Single Source of Truth (BACKLOG)

**Goal:** Сделать TopologySchema статической, перевернуть зависимость: схема — источник истины, каталог SERVICE выводится из неё. Это позволит z.infer работать для всех composed schemas и убрать ручные типы через `&` во всех per-service env schemas. Вариант 2: единый источник истины в схеме. Также убрать `as XxxEnv` касты в loadConfig() вызовах во всех 6 main.ts — сейчас касты необходимы из-за динамического TopologySchema, после рефакторинга z.infer выведет точные типы автоматически.
**Requirements:** TBD
**Plans:** 2/2 plans complete

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.2: Type-safe config access — eliminate ConfigService type loss (BACKLOG)

**Goal:** ConfigService.get<string>() теряет Zod-гарантии — возвращает `string | undefined` хотя Zod уже валидировал. Это вынуждает использовать `!` и `?? ''` повсюду. Нужен типизированный доступ к конфигу, чтобы TypeScript видел гарантии Zod. Возможные подходы: typed ConfigService wrapper, inject parsed config напрямую, или custom provider.
**Known occurrences:**
- `gateway/health/health.controller.ts` — `SERVICE.auth.envKeys.GRPC_URL!` и `?? ''` для gRPC service list
- `gateway/throttle/throttle.module.ts` — `configService.get<number>('RATE_LIMIT_BURST_TTL')!` и другие магические строки (нарушает no-magic-values skill)
- Все 6 `main.ts` — `loadConfig(XxxEnvSchema) as XxxEnv` касты (связано с 999.1)
- `foundation/cache/cache.providers.ts` — `config.get<string>('REDIS_URL')!` магическая строка + assertion
- `foundation/persistence/persistence.providers.ts` — `config.get<string>('DATABASE_URL')` тот же паттерн
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.4: CacheService quality — improve get() type safety and error handling (BACKLOG)

**Goal:** `CacheService.get<T>()` имеет две проблемы: (1) `JSON.parse(raw) as T` — unchecked type assertion, caller получает typed result без runtime проверки; (2) `catch { return null }` — молча проглатывает ошибку парсинга повреждённых данных, вызывающий код думает что ключа нет. Нужно: либо принимать optional validator/schema, либо логировать ошибку парсинга, либо возвращать raw string при ошибке. Зафиксировано в code review Phase 21 как WR-02.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.3: PersistenceModule — убрать PG_POOL export наружу (BACKLOG)

**Goal:** PG_POOL экспортируется из PersistenceModule и доступен сервисам через DI, но это протечка инфраструктуры — сервисы должны работать через DRIZZLE (ORM абстракция), а не через raw pool. Проверить используется ли PG_POOL в apps/, если нет — убрать из exports. Если да — заменить на ORM операции. Аналогичный принцип применить ко всем infrastructure modules: экспортировать абстракцию, не raw client.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.5: Вынести CacheModule конфигурацию в infrastructure layer сервисов (BACKLOG)

**Goal:** Сейчас `CacheModule.forRootAsync({ namespace: 'sender' })` конфигурируется прямо в root module sender. По согласованному паттерну (как config, storage) конфигурация должна быть в `infrastructure/cache/sender-cache.module.ts`, а root module просто импортирует `SenderCacheModule`. Привести к единому стилю: foundation даёт заготовку, сервис конфигурирует в infrastructure/, root module импортирует готовый модуль.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)
