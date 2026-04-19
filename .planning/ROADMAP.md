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
- [x] **Phase 23: gRPC Client Typed Wrappers** - Type-safe gRPC client framework in foundation with deadline propagation (completed 2026-04-15)
- [x] **Phase 24: HTTP Client & Circuit Breaker** - HTTP client framework with retry, timeout, circuit breaker for external APIs (completed 2026-04-15)
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

### Phase 22.5: local-garage-unification (INSERTED)

**Goal:** Унификация local storage backend на Garage — заменить MinIO в local-native и local-isolated окружениях на Garage Docker image, обновить docker-compose/env-schemas/runbook, чтобы все 4 окружения использовали один и тот же S3 impl. Устраняет расхождения между MinIO (local) и Garage (dev/prod) в семантике bucket policy, URL формата, CLI. Также объединяет bucket rename reports → public (DI tokens, smoke controllers, health controllers) — plumbing scope shifted from 22.4 per CONTEXT D-18..D-23.
**Requirements**: D-01..D-33 (locked decisions in 22.5-CONTEXT.md serve as requirement surface — no REQ-IDs in REQUIREMENTS.md)
**Depends on:** Phase 22
**Plans:** 4 plans

Plans:
- [ ] 22.5-01-PLAN.md — Replace MinIO with Garage v2.1.0 in compose stacks + commit garage.toml + garage-bootstrap.sh + env files + npm script
- [ ] 22.5-02-PLAN.md — Foundation rename: external/storage/reports/ → public/, REPORTS_* → PUBLIC_* symbols, barrel flip
- [ ] 22.5-03-PLAN.md — Update parser+notifier storage modules, smoke controllers, and health controllers to PUBLIC_* surface
- [ ] 22.5-04-PLAN.md — Rewrite docs/runbooks/bucket-provisioning.md for all 4 envs + live local smoke+readiness acceptance checkpoint

### Phase 22.4: public-bucket-abstraction (INSERTED)

**Goal:** Разделить хранилище на per-service private bucket'ы + один `public` bucket для внешних download-ссылок. Убрать presigned-URL механизм. Добавить `SharedNamespaceModule` c typed namespaced-клиентами, `NamespacedStoragePort` (Readable-only, multipart через `@aws-sdk/lib-storage`). Bucket rename `reports` → `public` уже выполнен в Phase 22.5; 22.4 добавляет env `STORAGE_PUBLIC_URL` + `STORAGE_MAX_UPLOAD_BYTES`, переписывает smoke 22.3 под новый контракт, обновляет runbook с anonymous-read policy.
**Requirements**: SSMK-01..05 (rewritten surface); D-01..D-27 (locked decisions in 22.4-CONTEXT.md serve as primary requirement surface); SPRV-01..05 runbook additions
**Depends on:** Phase 22, Phase 22.5
**Plans:** 3/3 plans complete

Plans:
- [x] 22.4-01-PLAN.md — Foundation port+factory+deps: NamespacedStoragePort, SharedNamespaceModule.forNamespace, lib-storage multipart, size-limit Transform, env schema extension, remove presigner
- [x] 22.4-02-PLAN.md — Apps integration: rewire parser+notifier to SHARED_REPORTS, rewrite smoke controllers (Readable + HTTP GET), sync .env* files, remove obsolete PublicStorageModule facade
- [x] 22.4-03-PLAN.md — Runbook update: anonymous-read policy step, new env vars, Garage URL caveat, private-bucket warning, verify curl step

### Phase 22.3: storage-smoke-test-endpoints (INSERTED)
**Goal**: Each storage-using service exposes temporary gRPC+REST endpoints that exercise the full StoragePort surface for every bound bucket, enabling end-to-end runtime verification across all deployment environments
**Depends on**: Phase 22, Phase 22.1, Phase 22.2
**Requirements**: SSMK-01, SSMK-02, SSMK-03, SSMK-04, SSMK-05
**Success Criteria** (what must be TRUE):
  1. Parser exposes smoke endpoints for both PARSER_STORAGE and REPORTS_STORAGE covering upload, download, delete, exists, getSignedUrl
  2. Notifier exposes smoke endpoints for REPORTS_STORAGE covering the same StoragePort surface
  3. Cross-service shared bucket flow is demonstrably runnable: parser uploads to reports bucket, notifier downloads the same key from reports bucket -- proves shared storage works end-to-end
  4. Endpoints are gated by a required env flag (config value, no NODE_ENV/isDev/isProd reads) -- disabled by default in shipped artifacts
  5. The same endpoint contracts are reachable across all four deployment environments (local-native, local-docker, dev-Coolify, prod-Coolify) so a single test plan validates the entire matrix
**Plans**: 3 plans
Plans:
- [x] 22.3-01-PLAN.md — Proto definitions (parser.proto smoke rpc + new notifier.proto) + notifier gRPC infrastructure
- [x] 22.3-02-PLAN.md — Storage smoke gRPC controllers in parser and notifier test/ directories
- [x] 22.3-03-PLAN.md — Gateway REST proxy controller under /test/ with gRPC clients to parser and notifier

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
**Plans**: 4 plans
Plans:
- [x] 23-01-PLAN.md — Migrate SERVICE.diToken to Symbol.for() + delete obsolete GrpcClientModule
- [x] 23-02-PLAN.md — Foundation AbstractGrpcClient + per-call deadline metadata + health indicator
- [x] 23-03-PLAN.md — Five per-service client modules (audience, auth, parser, sender, notifier) + barrel
- [x] 23-04-PLAN.md — Gateway integration: GrpcClientsModule + smoke migration + readiness wiring + sanity probe

### Phase 24: HTTP Client & Circuit Breaker
**Goal**: Services can call external APIs through a resilient HTTP client with automatic retry, timeout, logging, and circuit breaker protection
**Depends on**: Phase 20
**Requirements**: HTTP-01, HTTP-02, HTTP-03, HTTP-04
**Success Criteria** (what must be TRUE):
  1. Foundation provides an HTTP client framework with configurable retry, timeout, and structured request/response logging
  2. Circuit breaker is integrated into the HTTP abstraction -- after N consecutive failures to an external endpoint, calls fail fast without making the request
  3. Per-service adapters exist (or can be created) for AppStoreSpy, Telegram Bot API, and Cloud Functions, each built on the shared framework
  4. Circuit breaker applies only to external HTTP calls -- internal gRPC communication is not affected by circuit breaker state
**Plans**: 3 plans
Plans:
- [x] 24-01-PLAN.md — Foundation HTTP primitives: opossum + AbstractHttpClient + retry + CB + errors + types, export via foundation barrel
- [x] 24-02-PLAN.md — Contracts external types (Telegram/AppStoreSpy/CloudFn) + external-apis config sub-schema + per-service env extensions + .env files
- [x] 24-03-PLAN.md — Three per-service adapters + smoke controllers + notifier stub migration + VALIDATION.md Nyquist flip

### Phase 24.1: HTTP client foundation hardening — DI, env hygiene, magic values, smoke refactor (INSERTED)

**Goal:** Architectural hardening of the Phase 24 HTTP foundation. Decompose the 240-line AbstractHttpClient God class into thin orchestrator + ports/adapters (HttpRequestExecutor, RetryExecutorPort + DefaultRetryExecutor, CircuitBreakerPort + OpossumCircuitBreakerAdapter, HttpClientLogger + PinoHttpClientLoggerAdapter). Introduce HttpClientError abstract base + chain-of-mappers normalizer. Replace 4 `config.get<T>(KEY)!` non-null assertions with `ConfigService.getOrThrow<T>(KEY)`. Extract magic values (HTTP_CLIENT_HEADERS, HTTP_SMOKE_DEFAULTS). Introduce `httpClientProvider` factory eliminating 4-fold per-vendor boilerplate. Split HttpSmokeClient into `apps/gateway/src/infrastructure/clients/http-smoke/` (client) + `apps/gateway/src/test/http-smoke/` (controller+module with TODO remove-before-release). Rotate leaked Telegram bot token, `git rm --cached .env.docker`, create `.env.docker.example` (variant B) + `docs/runbooks/env-setup.md`. No behavior change — pure quality/security refactor verified via Phase 24 HttpSmokeController runtime invariants.
**Requirements**: HARD-01..HARD-08 (decisions D-01..D-37 in 24.1-CONTEXT.md serve as primary requirement surface — no new REQ-IDs in REQUIREMENTS.md; this is a refactor of HTTP-01..HTTP-04 already Complete)
**Depends on:** Phase 24
**Plans:** 4/4 plans complete

Plans:
- [x] 24.1-01-PLAN.md — Foundation port+adapter scaffolding: constants split, types, error hierarchy + chain-of-mappers, retry ports, CB port + opossum adapter, logger port + Pino adapter, DI tokens, Wave 0 scripts (check-no-bang.sh, check-env-parity.sh)
- [x] 24.1-02-PLAN.md — Thin AbstractHttpClient orchestrator (param-bag, ~80-120 lines) + httpClientProvider factory + D-16/D-17 barrel cleanup + delete 6 pre-24.1 root-level files
- [x] 24.1-03-PLAN.md — Migrate 3 per-vendor clients+modules (telegram/appstorespy/cloudfn) to param-bag + httpClientProvider + getOrThrow; split HttpSmokeClient to infrastructure/; extract HTTP_SMOKE_DEFAULTS + status(code) builder + CircuitState return types; remove HTTP_CLIENT_DEFAULTS compat bridge
- [x] 24.1-04-PLAN.md — Env hygiene: rotate Telegram token via @BotFather + Coolify prod/dev, git rm --cached .env.docker, create .env.docker.example (variant B), create docs/runbooks/env-setup.md (4-env matrix + rotation + sync rule), final runtime smoke verification

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
**Plans**: 0 plans (not yet planned)

### Phase 26: Graceful Shutdown
**Goal**: When a service receives SIGTERM, all in-flight work completes and all connections close in the correct order before the process exits
**Depends on**: Phase 21, Phase 22, Phase 23, Phase 24, Phase 25
**Requirements**: SHUT-01, SHUT-02, SHUT-03
**Success Criteria** (what must be TRUE):
  1. A centralized ShutdownOrchestrator coordinates teardown of all registered modules in a defined order
  2. In-flight HTTP and gRPC requests complete before connections are closed -- no abrupt termination mid-request
  3. Shutdown order is enforced: stop accepting new requests, drain in-flight work, then close connections in reverse dependency order (RabbitMQ, Redis, PostgreSQL)
**Plans**: 0 plans (not yet planned)

### Phase 27: Distributed Tracing
**Goal**: A single correlation ID follows a request from gateway entry through all downstream gRPC calls and RabbitMQ event chains, visible in every log line
**Depends on**: Phase 23, Phase 25
**Requirements**: TRACE-01, TRACE-02, TRACE-03
**Success Criteria** (what must be TRUE):
  1. Correlation ID is automatically injected into gRPC metadata on outgoing calls and extracted on incoming calls -- no manual plumbing in service code
  2. Correlation ID is automatically injected into RabbitMQ message headers on publish and extracted on consume
  3. A request entering gateway produces logs across all downstream services (gRPC and event-driven) that share the same correlation ID
**Plans**: 0 plans (not yet planned)

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
| 22.3. Storage Smoke Test Endpoints | v4.0 | 4/4 | Complete    | 2026-04-14 |
| 23. gRPC Client Typed Wrappers | v4.0 | 4/4 | Complete    | 2026-04-15 |
| 24. HTTP Client & Circuit Breaker | v4.0 | 3/3 | Complete    | 2026-04-15 |
| 24.1. HTTP client foundation hardening | v4.0 | 4/4 | Complete    | 2026-04-16 |
| 25. RabbitMQ EventModule | v4.0 | 0/0 | Not started | - |
| 26. Graceful Shutdown | v4.0 | 0/0 | Not started | - |
| 27. Distributed Tracing | v4.0 | 0/0 | Not started | - |

## Backlog

### Phase 999.1: TopologySchema Static Refactor — Single Source of Truth (BACKLOG)

**Goal:** Сделать TopologySchema статической, перевернуть зависимость: схема — источник истины, каталог SERVICE выводится из неё. Это позволит z.infer работать для всех composed schemas и убрать ручные типы через `&` во всех per-service env schemas. Вариант 2: единый источник истины в схеме. Также убрать `as XxxEnv` касты в loadConfig() вызовах во всех 6 main.ts — сейчас касты необходимы из-за динамического TopologySchema, после рефакторинга z.infer выведет точные типы автоматически.
**Requirements:** TBD
**Plans:** 2/3 plans executed

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
- Foundation gRPC client modules (14+ occurrences in auth/audience/parser/sender/notifier-client.module.ts) — left out of Phase 24.1 scope per orchestrator memo
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

### Phase 999.6: Настроить HTTPS для Garage WebUI на Coolify (BACKLOG)

**Goal:** Garage WebUI (garage.dev.email-platform.pp.ua и garage.email-platform.pp.ua) сейчас доступен только по HTTP. Настроить HTTPS — через Traefik auto-TLS или Cloudflare proxy для этих доменов. После исправления — обновить docs/runbooks/bucket-provisioning.md обратно на https:// и S3 endpoint порты с 80 на 443.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.7: Перенести gRPC client modules из foundation в infrastructure layer сервисов (BACKLOG)

**Goal:** Декаплинг foundation от contracts: 5 typed-facade gRPC клиентов переезжают из packages/foundation/ в apps/{consumer}/src/infrastructure/clients/{upstream}/. Foundation остаётся domain-agnostic — предоставляет только примитивы (AbstractGrpcClient, GrpcClientHealthIndicator, defineGrpcClient()). Новая factory-функция defineGrpcClient() инкапсулирует ~60-строчный boilerplate в ~15-строчный consumer-side модуль. ESLint rule блокирует foundation->contracts регрессию.
**Requirements:** D-01..D-09 (locked decisions in 999.7-CONTEXT.md serve as requirement surface)
**Depends on:** Phase 23
**Plans:** 4/4 plans complete

Plans:
- [x] 999.7-01-PLAN.md — Foundation defineGrpcClient() factory + barrel update
- [x] 999.7-02-PLAN.md — Gateway: 5 per-upstream client dirs + rewire consumers
- [x] 999.7-03-PLAN.md — Cross-service: sender->audience, parser->notifier, audience->parser + root modules
- [x] 999.7-04-PLAN.md — Foundation cleanup: delete 5 per-service dirs + ESLint guard + full workspace verify

### Phase 999.7.1: gRPC client tokens refactor — generate inside defineGrpcClient() (INSERTED)

**Goal:** Move gRPC token derivation (`grpcToken`, `healthToken`) inside the foundation `defineGrpcClient()` factory — derived from `service.id.toUpperCase()` via `Symbol.for()`. Delete 8 per-upstream `*-client.constants.ts` files; named token re-exports (`AUTH_CLIENT_GRPC = grpc.grpcToken`) live in each `*-client.module.ts`. Strip dead `@Injectable`/`@Inject` decorators from 8 gRPC client classes (useFactory ignores them — they were dead code and leaked wiring concern into domain facades). Add ESLint guards (`no-restricted-syntax` for `@Injectable()`/`@Inject()` + `check-file/filename-blocklist` for `*-client.constants.ts`) scoped to the 8 enumerated gRPC client paths. Reference implementation of `infrastructure-client-layering` skill — sets the architectural standard for future HTTP/RMQ/Redis/S3/DB+ORM refactors.
**Requirements**: D-01..D-13 (locked decisions in 999.7.1-CONTEXT.md serve as requirement surface — no REQ-IDs in REQUIREMENTS.md; this is architectural cleanup of GRPC-01..GRPC-04 already Complete)
**Depends on:** Phase 999.7
**Plans:** 5/5 plans complete

Plans:
- [x] 999.7.1-01-PLAN.md — Wave 0: pre-refactor inventory audit (D-11) + install eslint-plugin-check-file@^2.8.0
- [x] 999.7.1-02-PLAN.md — Wave 1: foundation `defineGrpcClient` signature change + internal token derivation (D-01..D-03)
- [x] 999.7.1-03-PLAN.md — Wave 2: refactor 5 gateway gRPC upstreams (auth/sender/parser/audience/notifier) atomically (D-04..D-09)
- [x] 999.7.1-04-PLAN.md — Wave 2: refactor 3 cross-service gRPC upstreams (sender→audience, parser→notifier, audience→parser) atomically (D-04..D-09)
- [x] 999.7.1-05-PLAN.md — Wave 3: verify D-10 zero-diff for health.controller.ts + add ESLint guards (D-12a/b) + negative fixture test + human-verify runtime smoke

### Phase 999.7.2: gRPC client composition refactor — replace inheritance with injected GrpcCaller (INSERTED)

**Goal:** Заменить наследование `extends AbstractGrpcClient` на композицию через инжектируемый `GrpcCaller` helper. Текущая модель имеет скрытое состояние (`this.raw`, `this.call`, `this.serviceName` приходят «из base класса») и не позволяет переопределять отдельные части без extend. Композиция делает зависимости явными в конструкторе, снимает coupling «is-a», упрощает тесты (mock одной строкой), и согласуется с DI-идиомой NestJS. Foundation выносит `GrpcCaller` (метаданные + Observable→Promise + логирование) в отдельный сервис; 8 client classов получают `GrpcCaller` через DI и хранят `raw` stub явно. Также нужно расширить skill `infrastructure-client-layering`: предписать composition как стандарт для всех будущих infra clients (HTTP/RMQ/S3/Redis/DB+ORM подтянутся к этому паттерну в своих фазах).

**Why this phase:** обсуждение в Phase 999.7.1 retrospective показало что inheritance — антипаттерн для нашего случая (см. таблицу сравнения 4 альтернатив в session log). Variant A (composition + injected helper) выбран как идиоматичный для NestJS и минимальный по миграции.

**Depends on:** Phase 999.7.1 (нужен чтобы 8 client классов уже были декорато-free и контракт `defineGrpcClient` стабилизировался)
**Requirements:** D-01..D-17 (locked decisions in 999.7.2-CONTEXT.md serve as requirement surface — no REQ-IDs in REQUIREMENTS.md; this is architectural cleanup)
**Plans:** 6/6 plans complete

Plans:
- [x] 999.7.2-01-PLAN.md — Wave 1: foundation GrpcCaller helper + defineGrpcClient 2-arg build signature + barrel type export (D-01..D-09)
- [x] 999.7.2-02-PLAN.md — Wave 2: pilot AuthClient composition migration + runtime smoke checkpoint (D-11 + D-12)
- [x] 999.7.2-03a-PLAN.md — Wave 3: sweep 4 gateway-side clients (sender/parser/audience/notifier) — atomic commit per upstream (D-13 + D-14)
- [x] 999.7.2-03b-PLAN.md — Wave 4: sweep 3 cross-service clients (sender→audience, parser→notifier, audience→parser) — atomic commit per upstream (D-13 + D-14)
- [x] 999.7.2-04-PLAN.md — Wave 5: delete AbstractGrpcClient + update infrastructure-client-layering skill + append ESLint ClassDeclaration[superClass] guard (D-10 + D-15 + D-16)
- [x] 999.7.2-05-PLAN.md — Wave 6: create composition-over-inheritance universal skill + final runtime smoke BOTH start:native + start:isolated (D-17 + final D-12/D-14)


### Phase 999.7.3: gRPC client promisify proxy — replace per-method wrappers (INSERTED)

**Goal:** Заменить 8 hand-written `*.client.ts` per-method wrapper-классов и standalone `GrpcCaller` helper единым типизированным `Promisified<T>` Proxy в foundation. Consumer инжектирует `Promisified<XxxProto.XxxServiceClient>` напрямую — никаких custom client-классов в `apps/`. Proxy перехватывает любой Observable-возвращающий метод raw ts-proto клиента, добавляет `Metadata` с per-call deadline, конвертирует Observable→Promise через `lastValueFrom`, возвращает результат. Логирование/трассировку временно вырезаем (D-04 conscious observability regression) — будущая фаза по observability вернёт их через DI-injected logger (outer Proxy chain). Skill `infrastructure-client-layering` обновляется (gRPC reference section, ANTI-PATTERN 8); `composition-over-inheritance` cross-references как second canonical example.
**Requirements**: D-01..D-21 (locked decisions in 999.7.3-CONTEXT.md serve as requirement surface — no REQ-IDs in REQUIREMENTS.md; this is architectural cleanup of GRPC-01..GRPC-04 already Complete)
**Depends on:** Phase 999.7.2 (нужен чтобы `GrpcCaller` уже был extracted helper, чтобы клин при удалении был минимальным)
**Plans:** 6/6 plans complete

Plans:
- [x] 999.7.3-01-PLAN.md — Wave 1: foundation create promisify-grpc-client.ts + delete grpc-caller.ts + simplify defineGrpcClient (D-02..D-10)
- [x] 999.7.3-02-PLAN.md — Wave 2: pilot AuthClient migration to Promisified Proxy + runtime smoke checkpoint (D-09 + D-11 + D-15) — code complete; runtime smoke gate DEFERRED to Plan 03 (gateway compile-blocked by 4 unmigrated upstreams)
- [x] 999.7.3-03-PLAN.md — Wave 3: sweep 4 gateway upstreams (sender/parser/audience/notifier) — atomic commit per upstream (D-14 + D-15 + D-19) — gateway typecheck FULLY GREEN; deferred Plan-02 BLOCKING runtime smoke executed: structural design validated (gateway boots, /health/ready reaches all 5 upstreams), strict 5/5-up criterion deferred to Plan 04 (cross-service services blocked from boot)
- [x] 999.7.3-04-PLAN.md — Wave 4: sweep 3 cross-service upstreams (sender→audience, parser→notifier, audience→parser) — atomic commit per upstream (D-14 + D-15 + D-19) — workspace typecheck FULLY GREEN (12/12 turbo tasks); D-15 8-path invariant achieved; post-sweep validation PASSED with strict 5/5-upstreams-up criterion (HTTP 200)
- [x] 999.7.3-05-PLAN.md — Wave 5: storage-smoke.controller.ts type-only patch + workspace-wide invariant battery (D-11 + D-17) — Task 1 satisfied transitively by Plan 03 (storage-smoke retype bundled into eec1619 + 517d30f); Plan 05 contributes 6-probe invariant verification battery (typecheck 0, lint 0 after Rule-1 prettier-format auto-fix, D-15 0 files, 0 source GrpcCaller refs, D-16 ESLint guard preserved with 8 enumerated paths, D-17 Promisified<T> confirmed); commit `42770da`
- [x] 999.7.3-06-PLAN.md — Wave 6: skill updates (infrastructure-client-layering ANTI-PATTERN 8 + composition-over-inheritance cross-ref) + final dual-mode runtime smoke (D-19 + D-20 + D-21)

### Phase 999.8: Мигрировать TelegramClient на SDK (telegraf / grammY), operation-level logging (BACKLOG)

**Goal:** Telegram Bot API использует path-based auth — токен зашит в URL (`/bot<TOKEN>/method`). Это протокол Telegram, не наш выбор. Сейчас `TelegramClient` extends `AbstractHttpClient` и логирует URL как есть — токен утекает в логи (`http.client.call` с `url: ".../bot8679564424:AAF-.../sendMessage"`). Решение: переехать на vendor SDK (рекомендуется grammY — TypeScript-first, современнее; telegraf — зрелая альтернатива). SDK скрывает URL внутри и предоставляет operation-level API (`bot.api.sendMessage(chatId, text)`). `TelegramClient` становится тонкой обёрткой над SDK, логирует **операции** (`api: 'TelegramClient', operation: 'sendMessage', duration_ms, status, correlationId`), а не HTTP transport — URL с токеном физически не существует в поле лога. При этом `AbstractHttpClient` продолжает логировать URL для AppStoreSpy/CloudFn (у них auth в header, URL без секретов). Фаза закрывает D-16 долг, оставленный в Phase 24.
**Known issue:** `apps/notifier/src/infrastructure/clients/telegram/telegram.client.ts` использует `AbstractHttpClient.post('/bot<TOKEN>/sendMessage', ...)` — URL с токеном попадает в `http.client.call` log field.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.9: gRPC client RxJS leakage refinements (open discussion) (BACKLOG)

**Goal:** Open-for-discussion polish on `AbstractGrpcClient` (RxJS surface). Surfaced during Phase 999.7.1 retrospective. NO commitment to implement until reviewed — items 1/2/4 are minor polish; item 3 is conditional on adding streaming RPCs.

**Items to evaluate:**
1. Replace `lastValueFrom` with `firstValueFrom` in `AbstractGrpcClient.call()` — semantically tighter for unary
2. Add `AbortSignal` cancellation support to `CallOpts` (client-side cancel via `takeUntil(fromEvent(signal, 'abort'))`)
3. Streaming RPC adapter (`callStream`/`callIterable` returning `AsyncIterable<T>`) — only if streaming RPCs added later
4. Pin RxJS major version range in `packages/foundation/package.json` (defensive vs NestJS RxJS upgrades)

**Reference:** `packages/foundation/src/external/grpc/clients/abstract-grpc-client.ts` (Phase 999.7.x)
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.10: Application architecture — add Service layer + restructure Hexagonal stack across all microservices (ARCHITECTURALLY COMPLETE — awaiting /gsd:verify-work)

**Goal:** Standardize NestJS↔Hexagonal layer mapping across all 6 microservices. Introduce unified `Controller → Service → UseCase` 3-layer stack (Service = composition layer implementing наш inbound port, UseCase = atomic operation), rename controllers without transport suffix (`AuthGrpcServer` → `AuthController`), move health controllers to `infrastructure/controllers/rest/`, fix as skill `nestjs-hexagonal-mapping`, update CLAUDE.md / `.planning/codebase/ARCHITECTURE.md` with call-flow diagram + proto-visibility table.

**Why this phase:** обсуждение между user и agent 2026-04-18 после Phase 999.7.3 (server-side gRPC pattern audit). Auth — Hexagonal reference impl, но НЕТ Application Service слоя (use cases имплементируют inbound ports напрямую). Naming inconsistency: `AuthGrpcServer` vs `HealthController`. HealthController в outlier `apps/{service}/src/health/` вместо `infrastructure/controllers/rest/`. Pattern не зафиксирован skill'ом → drift риск. Все architectural decisions уже зафиксированы в pre-discussion notes (999.10-NOTES.md, 12 D-LOCKED entries).

**Locked decisions (D-LOCKED-01..D-LOCKED-12 in NOTES.md):**
1. Унифицированный 3-слойный stack (Controller→Service→UseCase везде, всегда)
2. Per-feature service granularity (LoginService, RegisterService — не один большой)
3. Use case всегда отдельный класс (даже если pure delegation сегодня)
4. Controller naming без суффикса (`AuthController` not `AuthGrpcServer`)
5. Service implements OWN port (не proto interface)
6. Port = TypeScript interface который МЫ пишем руками (не из proto)
7. Один Module на bounded context (flat, без подмодулей)
8. NestJS-овские корневые папки поглощены Hexagonal слоями
9. Транспорт явный в пути (`infrastructure/controllers/{grpc,rest}/`)
10. Health всегда REST в `infrastructure/controllers/rest/`
11. Domain полностью изолирован (нет proto/Drizzle/NestJS imports)
12. Naming convention для файлов one-to-one с классами

**Open questions for discuss-phase:** scope (auth-only canary vs all 6 sweep), include CR-warnings auto-fix, skill name + scope, ESLint enforcement now or later, value objects/domain events introduction timing, Command/Query DTO convention adoption, mapper folder structure, migration order, docs update scope, existing use cases audit/refactoring impact.

**Pre-discussion artifact:** `.planning/phases/999.10-app-architecture-add-service-layer-restructure-hexagonal-stack/999.10-NOTES.md` (canonical model + ASCII diagrams + file structure + 10 open questions)

**Estimated scope:** 50-80 files modified/created (~4 controller renames, ~5 health moves, ~33 new services + 33 inbound ports, ~10-20 use case audit, 5 module updates, 1 new skill, 3 docs updates, optional ESLint guards). Comparable to Phase 999.7.3 (~30 files).

**Requirements:** D-01..D-24 (locked decisions in 999.10-CONTEXT.md serve as primary requirement surface — no REQ-IDs in REQUIREMENTS.md; this is architectural refactoring per 24 locked D-decisions)
**Plans:** 7/7 plans complete

Plans:
- [x] 999.10-01-PLAN.md — Skill `nestjs-hexagonal-mapping` (SKILL.md + 6 references/*.md; no code)
- [x] 999.10-02-PLAN.md — Auth pilot (full Controller → Service → UseCase refactor + 6 inbound ports + 6 services + 8 use cases per D-23 audit)
- [x] 999.10-03-PLAN.md — Sender sweep (11 RPCs → 10 services + shared TransitionCampaignStatusUseCase)
- [x] 999.10-04-PLAN.md — Parser sweep (8 RPCs via canonical stack — Pitfall 3 resolved via Option A canonicalise; StorageSmokeController deleted, smoke logic in 3 real-I/O use cases; atomic commit 22fcb5e)
- [x] 999.10-05-PLAN.md — Audience sweep (9 RPCs → 8 services + shared TransitionRecipientsStatusUseCase + GroupRepositoryPort symmetry; atomic commit ce8a39d)
- [x] 999.10-06-PLAN.md — ESLint layer guards (Override 8 domain + Override 9 application)
- [x] 999.10-07-PLAN.md — Docs update (CLAUDE.md + ARCHITECTURE.md + STRUCTURE.md) + dual-mode phase gate — PASSED (native + isolated HTTP 200 5/5 upstreams up, 0 error/warn across 6 Docker containers, 13/13 structural invariants PASS; atomic docs commit 2c1b249; user "approved")

---

### Phase 999.10.1: Hexagonal naming convention refactor — apply Option B + runtime-identity field naming across 4 gRPC services (BACKLOG)

**Goal:** Apply the naming conventions resolved in post-999.10 dialogue (2026-04-19) across all 4 gRPC microservices (auth/sender/parser/audience) and document them in `CLAUDE.md` + `nestjs-hexagonal-mapping` skill. The refactor eliminates Hungarian-notation redundancy on fields while preserving architectural signal on types and DI tokens.

**Why this phase:** После архитектурного пилота 999.10 пользователь провёл research на best practices нейминга в Hexagonal (Cockburn, Vernon, Hombergs, Uncle Bob, Mark Seemann + enterprise codebases). Текущий pattern `listGroupsPort: ListGroupsPort` содержит triple-suffix redundancy которая противоречит Clean Code ch.2 "Meaningful Names" (Hungarian notation anti-pattern). Правильный pattern: field name отражает **runtime identity** (что DI bind'ит — Service / UseCase / Repository), type отражает **architectural contract** (Port interface), token остаётся architectural. Это разграничение доменно-role suffixes (Repository — сохраняем) от architectural-role suffixes (Port — не mirrorится на поле).

**Locked naming decisions (from 2026-04-19 dialogue):**

1. **Field name = runtime identity** (что DI bind'ит в runtime)
2. **Type = architectural contract** (через что abstraction проходит)
3. **Token (в constants.ts) = architectural concern** (хранит `_PORT` суффикс)
4. **Port — это concept уровня типа и токена, не имени переменной**

**Конкретные правила per слой:**

| Слой | Field name | Type | DI token | Runtime class |
|------|-----------|------|----------|---------------|
| Controller injects inbound port | `listGroupsService` | `ListGroupsPort` | `LIST_GROUPS_PORT` | `ListGroupsService` |
| Service injects use case | `verifyCredentials` | `VerifyCredentialsUseCase` | — (class reference) | `VerifyCredentialsUseCase` |
| UseCase injects outbound port | `userRepository` | `UserRepositoryPort` | `USER_REPOSITORY_PORT` | `PgUserRepository` |

**Pre-discussion artifact:** `.planning/phases/999.10.1-hexagonal-naming-convention-refactor/999.10.1-NOTES.md` (full dialogue snapshot + 2 research reports + locked decisions + open questions)

**Estimated scope:** ~50-80 files modified (field renames across 4 services × 3 layers × N RPCs; docs updates: CLAUDE.md + `.planning/codebase/ARCHITECTURE.md` + `.agents/skills/nestjs-hexagonal-mapping/references/NAMING.md`). Comparable to Phase 999.10 sweep size but mechanical (rename-only).

**Requirements:** Locked decisions above serve as primary requirement surface (no REQ-IDs; naming convention refactor per user dialogue 2026-04-19).
**Plans:** 5 plans

Plans:
- [x] 999.10.1-01-PLAN.md — auth pilot (6 controller + 4 use-case Repository field renames; services 6/6 already compliant) — PASSED (2 atomic commits 16c52f3 + e6ab119; dual-mode runtime smoke native + isolated HTTP 200 5/5 upstreams up; 13/13 structural grep invariants PASS on auth slice)
- [ ] 999.10.1-02-PLAN.md — sender sweep (10 controller + 4 use-case Repository + 10 service UseCase field renames per D-19)
- [ ] 999.10.1-03-PLAN.md — parser sweep (7 controller incl. 2 edge-case type-stem derivations + 3 use-case Repository + 7 service UseCase incl. 1 dual-field service)
- [ ] 999.10.1-04-PLAN.md — audience sweep (8 controller collision-showcase + 7 use-case Repository with D-20 atomic underscore drop + 8 service UseCase incl. shared TransitionRecipientsStatusUseCase)
- [ ] 999.10.1-05-PLAN.md — docs finalization (6 docs files atomic commit per D-13/D-14/D-22 + checkpoint:human-verify phase gate)
