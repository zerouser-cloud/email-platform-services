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
3. All env vars use S3*\* prefix (S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET) -- no MINIO*\* references remain in codebase
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
- [ ] 22.5-02-PLAN.md — Foundation rename: external/storage/reports/ → public/, REPORTS*\* → PUBLIC*\* symbols, barrel flip
- [ ] 22.5-03-PLAN.md — Update parser+notifier storage modules, smoke controllers, and health controllers to PUBLIC\_\* surface
- [ ] 22.5-04-PLAN.md — Rewrite docs/runbooks/bucket-provisioning.md for all 4 envs + live local smoke+readiness acceptance checkpoint

### Phase 22.4: public-bucket-abstraction (INSERTED)

**Goal:** Разделить хранилище на per-service private bucket'ы + один `public` bucket для внешних download-ссылок. Убрать presigned-URL механизм. Добавить `SharedNamespaceModule` c typed namespaced-клиентами, `NamespacedStoragePort` (Readable-only, multipart через `@aws-sdk/lib-storage`). Bucket rename `reports` → `public` уже выполнен в Phase 22.5; 22.4 добавляет env `STORAGE_PUBLIC_URL` + `STORAGE_MAX_UPLOAD_BYTES`, переписывает smoke 22.3 под новый контракт, обновляет runbook с anonymous-read policy.
**Requirements**: SSMK-01..05 (rewritten surface); D-01..D-27 (locked decisions in 22.4-CONTEXT.md serve as primary requirement surface); SPRV-01..05 runbook additions
**Depends on:** Phase 22, Phase 22.5
**Plans:** 3/3 plans complete

Plans:

- [x] 22.4-01-PLAN.md — Foundation port+factory+deps: NamespacedStoragePort, SharedNamespaceModule.forNamespace, lib-storage multipart, size-limit Transform, env schema extension, remove presigner
- [x] 22.4-02-PLAN.md — Apps integration: rewire parser+notifier to SHARED_REPORTS, rewrite smoke controllers (Readable + HTTP GET), sync .env\* files, remove obsolete PublicStorageModule facade
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
4. pnpm build remains green; all existing storage DI tokens (PARSER_STORAGE, REPORTS_STORAGE, \*\_STORAGE_HEALTH) still resolve correctly after refactor
   **Plans**: 5 plans
   Plans:

- [x] 22.1-01-PLAN.md — Create external/internal skeletons, relocate storage primitives to internal/storage/, remove @Global(), rewrite ReportsStorageModule with explicit S3CoreModule import
- [x] 22.1-02-PLAN.md — Relocate non-storage subsystems to external/, flip top-level barrel to one-line re-export, drop S3CoreModule from parser.module.ts and notifier.module.ts
- [x] 22.1-03-PLAN.md — Add exports field to foundation package.json, upgrade tsconfig.base.json to node16/node16, force rebuild
- [x] 22.1-04-PLAN.md — Rewrite parser-storage.module.ts with @email-platform/foundation/internal subpath imports, delete Plan 02 BucketStorageModule compat shim
- [x] 22.1-05-PLAN.md — Add single static ESLint rule (apps/_/src override + apps/_/src/infrastructure override), automated probe verification, human-verified boot smoke tests

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

| Phase                                      | Milestone | Plans Complete | Status      | Completed  |
| ------------------------------------------ | --------- | -------------- | ----------- | ---------- |
| 1. Contract Consolidation                  | v1.0      | 1/1            | Complete    | 2026-04-04 |
| 2. Configuration Management                | v1.0      | 3/3            | Complete    | 2026-04-04 |
| 3. Error Handling & Safety                 | v1.0      | 2/2            | Complete    | 2026-04-04 |
| 4. Architecture Reference Implementation   | v1.0      | 2/2            | Complete    | 2026-04-04 |
| 5. Architecture Replication & Boundaries   | v1.0      | 3/3            | Complete    | 2026-04-04 |
| 6. Health & Resilience                     | v1.0      | 3/3            | Complete    | 2026-04-04 |
| 7. Logging, Security & Operations          | v1.0      | 2/2            | Complete    | 2026-04-04 |
| 8. Verification                            | v1.0      | 2/2            | Complete    | 2026-04-04 |
| 9. Config & MongoDB Cleanup                | v2.0      | 1/1            | Complete    | 2026-04-04 |
| 10. Foundation DrizzleModule & Health      | v2.0      | 1/1            | Complete    | 2026-04-04 |
| 11. Docker Infrastructure                  | v2.0      | 1/1            | Complete    | 2026-04-04 |
| 12. Auth Schema & Repository (Reference)   | v2.0      | 1/1            | Complete    | 2026-04-04 |
| 13. Remaining Services Schema & Repository | v2.0      | 1/1            | Complete    | 2026-04-04 |
| 14. Verification & Documentation           | v2.0      | 1/1            | Complete    | 2026-04-04 |
| 15. Docker Compose Split & Environment     | v3.0      | 1/1            | Complete    | 2026-04-04 |
| 16. CI Pipeline                            | v3.0      | 1/1            | Complete    | 2026-04-04 |
| 16.1. Docker Port Isolation                | v3.0      | 1/1            | Complete    | 2026-04-04 |
| 17. Docker Image Build & Push              | v3.0      | 1/1            | Complete    | 2026-04-04 |
| 17.1. Fix DI Double Registration           | v3.0      | 1/1            | Complete    | 2026-04-04 |
| 17.2. No Magic Values Skill & Audit        | v3.0      | 3/3            | Complete    | 2026-04-04 |
| 18. Deployment via Coolify                 | v3.0      | 3/3            | Complete    | 2026-04-06 |
| 18.1. Deployment Polish                    | v3.0      | 2/2            | Complete    | 2026-04-08 |
| 19. Verification                           | v3.0      | 0/0            | Complete    | 2026-04-08 |
| 20. Config Decomposition                   | v4.0      | 2/2            | Complete    | 2026-04-08 |
| 21. Redis CacheModule                      | v4.0      | 2/2            | Complete    | 2026-04-08 |
| 22. S3 StorageModule                       | v4.0      | 3/3            | Complete    | 2026-04-09 |
| 22.3. Storage Smoke Test Endpoints         | v4.0      | 4/4            | Complete    | 2026-04-14 |
| 23. gRPC Client Typed Wrappers             | v4.0      | 4/4            | Complete    | 2026-04-15 |
| 24. HTTP Client & Circuit Breaker          | v4.0      | 3/3            | Complete    | 2026-04-15 |
| 24.1. HTTP client foundation hardening     | v4.0      | 4/4            | Complete    | 2026-04-16 |
| 25. RabbitMQ EventModule                   | v4.0      | 0/0            | Not started | -          |
| 26. Graceful Shutdown                      | v4.0      | 0/0            | Not started | -          |
| 27. Distributed Tracing                    | v4.0      | 0/0            | Not started | -          |

## Backlog

### Phase 999.1: Config System Audit (audit-only phase) (PROMOTED)

**Goal:** Провести **полный audit** системы конфигов проекта с трассировкой usage по всей кодовой базе — не только где конфиги объявляются, но и где/как используются, куда проистекают, какие архитектурные инварианты нарушаются. **Фаза docs-only** — никакого кода не трогаем. Deliverables: **`999.1-AUDIT.md`** (inventory + categorized findings по 5 слоям) + **`999.1-SOLUTIONS.md`** (2-4 варианта фикса per finding с trade-offs и recommended pick). После завершения — user review checkpoint вне фазы: по каждому approved solution создаётся своя sub-phase (999.1.1, 999.1.2, ...) через `/gsd:insert-phase`. Audit scope: **(Layer 1 Definition & Loading)** packages/config/_, apps/_/bootstrap/config/\*, drizzle.config.ts, foundation narrow-config; **(Layer 2 Usage tracing)** все `@Inject({SVC}_CONFIG)` callsites, narrow config port consumers, SERVICE catalog reads, main.ts bootstrap reads, CLI/scripts; **(Layer 3 Violations)** direct `process.env` outside legal zones, hardcoded magic values that should be config, non-null assertions, type casts на config surface; **(Layer 4 Propagation)** app→foundation slice factory boundaries, cross-service via catalog, RMQ inbound, documentation drift (CLAUDE.md + infrastructure-client-layering SKILL + env-schema SKILL + twelve-factor SKILL); **(Layer 5 Missing configs)** env-значения упоминаемые но не в схеме, .env.example vs фактическое usage, infrastructure config (docker-compose, Coolify, CI) vs app config coherence. Принцип фазы: verify-against-reality — каждое finding'а бэкапится grep/Read выдачей, чтобы не было спекуляций о текущем состоянии. Precedent для audit-only phase: Phase 999.11.3 (docs-only skill refresh).
**Requirements:** D-01..D-20 (locked decisions in 999.1-CONTEXT.md serve as requirement surface — no REQ-IDs in REQUIREMENTS.md; docs-only audit phase)
**Depends on:** Phase 999.11.3 (latest config-related architectural state — {SVC}\_CONFIG Symbol contract from 999.11.1 D-08, bootstrap/config placement from 999.11.2, refreshed skill from 999.11.3 — audit measures against this baseline)
**Plans:** 5/4 plans complete

Plans:

- [x] 999.1-01-PLAN.md — Lock canonical config system design (DESIGN.md: 7-level taxonomy + 29 invariants + cross-ref matrix)
- [x] 999.1-02-PLAN.md — Audit config system against canonical design (AUDIT.md: 5-layer findings catalog with F-NN template)
- [x] 999.1-03-PLAN.md — Propose migration variants + backlog impact (SOLUTIONS.md: 2-4 variants per F-NN + sub-phase groupings)
- [x] 999.1-04-PLAN.md — Verification + summary + flip nyquist flag (VERIFICATION.md grep-proof table + SUMMARY.md + VALIDATION.md frontmatter flip)

### Phase 999.1.9: config-layering-refactor-services-first-structure (INSERTED)

**Goal:** Full config-system refactor per Three-Layer Rule — restructure `packages/config/src/` into `infra/` (shared building blocks) + `apps/{name}/` (per-service mirror of `/apps/{name}/`). Eliminate dynamic TopologySchema (static per-service spread), remove intersection-alias types (z.infer only), unify config access through DI (`app.get<XxxEnv>(XXX_CONFIG)` in main.ts), add HTTP↔gRPC server port symmetry (`{SVC}_GRPC_PORT` env var), move env parity check to CI. Resolves F-01 root finding (12× `as XxxEnv` casts).
**Requirements**: D-01..D-23 from 999.1.9-CONTEXT.md (23 locked user decisions) + F-01 finding parent.
**Depends on:** Phase 999.1, Phase 999.1.8
**Plans:** 11/11 plans complete

Plans:

- [x] 999.1.9-01-PLAN.md — W1: Package structure setup (infra/ + apps/ skeletons, 8 shared schemas moved, coexistence with legacy)
- [x] 999.1.9-02-PLAN.md — W2: Env vars addition — 5× `{SVC}_GRPC_PORT` in 4 env files (D-15) [infrastructure-guard gate]
- [x] 999.1.9-03-PLAN.md — W3: Audience canary migration + foundation factories (createConfigModule D-10, grpc-server.factory D-16) + dual-mode smoke [canary gate]
- [x] 999.1.9-04-PLAN.md — W4: Auth service migration (no peers)
- [x] 999.1.9-05-PLAN.md — W5: Sender service migration (peer: audience + CloudFn split D-21)
- [x] 999.1.9-06-PLAN.md — W6: Parser service migration (peer: notifier + AppStoreSpy split D-21)
- [x] 999.1.9-07-PLAN.md — W7: Gateway service migration (5 peers + refine preservation + HTTP-only bootstrap)
- [x] 999.1.9-08-PLAN.md — W8: Notifier service migration (no peers + Telegram split D-21)
- [x] 999.1.9-09-PLAN.md — W9: Cleanup — delete topology.ts + env-schema.ts + compose.ts + catalog/ + schemas/ (18 files, 2 dirs)
- [x] 999.1.9-10-PLAN.md — W10: Env-parity CI integration (schema-driven check + GHA job) [infrastructure-guard gate]
- [x] 999.1.9-11-PLAN.md — W11: Final verification (grep invariants + dual-mode smoke + nyquist flip) [phase gate]

### Phase 999.1.8: config-mechanism-consolidation-and-process-env-elimination — re-audit Phase 999.1 gaps (F-15 CLI process.env, F-16 Identity/Mechanism split broken for config), research foundation/config factory shape symmetric to gRPC, amend DESIGN invariants (I-0.1 no CLI exception, new I-3.5 foundation owns config DI factory), implement loadConfig reloc + createConfigModule factory + migrate 4× drizzle.config + 6 apps (INSERTED, renumbered from 999.1.1 — that slot reserved by Phase 999.1 SOLUTIONS.md for F-01 TopologySchema refactor; see §Sub-Phase Grouping Proposal)

**Goal:** Close the 2 gaps discovered post-Phase-999.1-close (F-15 blocker CLI `process.env` reads in 4× drizzle.config.ts + F-16 major Identity/Mechanism split broken for config — `loadConfig` + `composeSchemas` in `packages/config/` with apps hand-rolling `@Global() {Svc}ConfigModule.forRoot()`) by inline-amending 999.1 audit artefacts (16 findings / 30 invariants including reworded I-0.1 + new I-3.5), relocating `loadConfig` to `packages/foundation/src/external/config/`, introducing foundation-owned `createConfigModule<TEnv>({schema, token, narrowPorts})` factory symmetric to gRPC `defineGrpcClient`, migrating 4× drizzle.config CLI files + 6× apps bootstrap/config modules to the factory, and passing the non-negotiable dual-mode runtime smoke gate per `runtime-smoke-verification` skill.
**Requirements**: F-15, F-16, I-0.1 (reworded), I-3.5 (new) — derived from Phase 999.1 post-close HANDOFF.md + 999.1.8-CONTEXT.md (23 locked decisions D-01..D-23).
**Depends on:** Phase 999.1. **Note:** this phase is foundational — completion may reshape scope of the originally-planned 999.1.1..999.1.7 sub-phases because F-15/F-16 resolve the Identity/Mechanism split for config, after which some sibling sub-phases (esp. 999.1.2 HTTP narrow-port symmetry) may simplify or absorb into the new factory pattern.
**Plans:** 6/6 plans complete

Plans:

- [x] 999.1.8-01-PLAN.md — Re-audit Phase 999.1: inline amend AUDIT/SOLUTIONS/DESIGN/SUMMARY/VERIFICATION (add F-15 + F-16 findings, reword I-0.1 without CLI exception, add I-3.5 foundation owns config DI factory, 29 → 30 invariants) + flip 999.1-VALIDATION.md to in_progress.
- [x] 999.1.8-02-PLAN.md — Research (NO-OP — research already captured in 999.1.8-RESEARCH.md; metadata-only placeholder for plan numbering).
- [x] 999.1.8-03-PLAN.md — Foundation side: create `packages/foundation/src/external/config/{load-config.ts, create-config-module.ts, index.ts}`, amend `external/index.ts` barrel, add zod runtime dep to foundation package.json (consumer-first D-04 — add without removing config side).
- [x] 999.1.8-04-PLAN.md — Consumer switchover: migrate 4× `apps/*/drizzle.config.ts` and 6× `apps/*/src/main.ts` to import `loadConfig` from `@email-platform/foundation`; delete `packages/config/src/config-loader.ts` + remove its barrel re-export (atomic commit, 12 files).
- [x] 999.1.8-05-PLAN.md — Apps migration: 6× services rewrite `{svc}-config.module.ts` to `createConfigModule<{Svc}Env>({...})` factory call, delete `{svc}-config.provider.ts` × 6, update `{svc}.module.ts` × 6 to import module as const (no `.forRoot()`), remove 6× barrel provider re-export lines (6 per-service atomic commits per D-21 template).
- [x] 999.1.8-06-PLAN.md — Verify phase gate: D-18 grep invariants (8/8), dual-mode runtime smoke (native + isolated) per `runtime-smoke-verification` skill, fill 999.1-VERIFICATION.md Observed cells, `/gsd:verify-work` on both 999.1 (re-verify) + 999.1.8, reflip 999.1-VALIDATION.md frontmatter back to complete + nyquist_compliant: true.

### Phase 999.2: Type-safe config access — ABSORBED INTO Phase 999.11.1 (2026-04-20)

**Status:** ABSORBED. Original scope (eliminate `configService.get<T>()!` non-null assertions, type-safe config access per service) was folded into Phase 999.11.1 — architecture-compliance-audit-and-fix — per that phase's CONTEXT.md decision D-12 (rationale: same files, shared migration window, atomic commits preferable to a 2-phase split with coordination overhead).

**Outcome realised by 999.11.1:** per-service `{SVC}_CONFIG` Symbol pattern (Canonical Config Access Contract per D-08..D-12), foundation narrow config interfaces (D-10), full `@nestjs/config` replace (D-11), 18 callsites migrated across 10 files + cascade through 3 HTTP vendor modules. All known occurrences listed below — `gateway/health/health.controller.ts`, `gateway/throttle/throttle.module.ts`, foundation cache/persistence/logging/storage/grpc/http — resolved in Phase 999.11.1 Plans 01-09.

**Original known occurrences (all closed by 999.11.1):**

- `gateway/health/health.controller.ts` — closed via D-05 relocation (Plan 02, commit `6dc6279`) + D-12 migration
- `gateway/throttle/throttle.module.ts` — closed via Plan 03 (commit `c1672a0`, IC-09 resolved)
- Все 6 `main.ts` — `loadConfig(XxxEnvSchema) as XxxEnv` касты remain (scheduled for separate Phase 999.1 — TopologySchema Static Refactor, not absorbed)
- `foundation/cache/cache.providers.ts` + `foundation/persistence/persistence.providers.ts` + `foundation/logging` + `foundation/storage` — closed via Plan 04 (commit `ab918d5`, D-10 narrow-config interfaces)
- Foundation gRPC client modules (5 × `*-client.module.ts`) — closed via Plan 05 (commit `7c591d7`, obsolete `grpc-client.module.ts` deleted)
- Foundation HTTP client + 3 vendor modules (telegram / appstorespy / cloudfn) — closed via Plan 06 (commit `930eca6`)
- `@nestjs/config` full removal — Plan 09 (commit `2d14d30`, D-11)

**Remaining Phase 999.2-adjacent work:** Phase 999.1 (TopologySchema Static Refactor) — not absorbed, backlog separate phase — will remove `as XxxEnv` casts in main.ts × 6 after TopologySchema static rewrite enables `z.infer` to resolve per-service composed schemas.

**Plans:** 0 plans (scope folded into 999.11.1)

Plans:

- [x] ABSORBED — see Phase 999.11.1 Plans 01-09 for implementation; Plan 10 docs-update commit records the absorption

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

- [x] 999.10-01-PLAN.md — Skill `nestjs-hexagonal-mapping` (SKILL.md + 6 references/\*.md; no code)
- [x] 999.10-02-PLAN.md — Auth pilot (full Controller → Service → UseCase refactor + 6 inbound ports + 6 services + 8 use cases per D-23 audit)
- [x] 999.10-03-PLAN.md — Sender sweep (11 RPCs → 10 services + shared TransitionCampaignStatusUseCase)
- [x] 999.10-04-PLAN.md — Parser sweep (8 RPCs via canonical stack — Pitfall 3 resolved via Option A canonicalise; StorageSmokeController deleted, smoke logic in 3 real-I/O use cases; atomic commit 22fcb5e)
- [x] 999.10-05-PLAN.md — Audience sweep (9 RPCs → 8 services + shared TransitionRecipientsStatusUseCase + GroupRepositoryPort symmetry; atomic commit ce8a39d)
- [x] 999.10-06-PLAN.md — ESLint layer guards (Override 8 domain + Override 9 application)
- [x] 999.10-07-PLAN.md — Docs update (CLAUDE.md + ARCHITECTURE.md + STRUCTURE.md) + dual-mode phase gate — PASSED (native + isolated HTTP 200 5/5 upstreams up, 0 error/warn across 6 Docker containers, 13/13 structural invariants PASS; atomic docs commit 2c1b249; user "approved")

---

### Phase 999.10.1: Hexagonal naming convention refactor — apply Option B + runtime-identity field naming across 4 gRPC services (ARCHITECTURALLY COMPLETE — awaiting /gsd:verify-work)

**Goal:** Apply the naming conventions resolved in post-999.10 dialogue (2026-04-19) across all 4 gRPC microservices (auth/sender/parser/audience) and document them in `CLAUDE.md` + `nestjs-hexagonal-mapping` skill. The refactor eliminates Hungarian-notation redundancy on fields while preserving architectural signal on types and DI tokens.

**Why this phase:** После архитектурного пилота 999.10 пользователь провёл research на best practices нейминга в Hexagonal (Cockburn, Vernon, Hombergs, Uncle Bob, Mark Seemann + enterprise codebases). Текущий pattern `listGroupsPort: ListGroupsPort` содержит triple-suffix redundancy которая противоречит Clean Code ch.2 "Meaningful Names" (Hungarian notation anti-pattern). Правильный pattern: field name отражает **runtime identity** (что DI bind'ит — Service / UseCase / Repository), type отражает **architectural contract** (Port interface), token остаётся architectural. Это разграничение доменно-role suffixes (Repository — сохраняем) от architectural-role suffixes (Port — не mirrorится на поле).

**Locked naming decisions (from 2026-04-19 dialogue):**

1. **Field name = runtime identity** (что DI bind'ит в runtime)
2. **Type = architectural contract** (через что abstraction проходит)
3. **Token (в constants.ts) = architectural concern** (хранит `_PORT` суффикс)
4. **Port — это concept уровня типа и токена, не имени переменной**

**Конкретные правила per слой:**

| Слой                            | Field name          | Type                       | DI token               | Runtime class              |
| ------------------------------- | ------------------- | -------------------------- | ---------------------- | -------------------------- |
| Controller injects inbound port | `listGroupsService` | `ListGroupsPort`           | `LIST_GROUPS_PORT`     | `ListGroupsService`        |
| Service injects use case        | `verifyCredentials` | `VerifyCredentialsUseCase` | — (class reference)    | `VerifyCredentialsUseCase` |
| UseCase injects outbound port   | `userRepository`    | `UserRepositoryPort`       | `USER_REPOSITORY_PORT` | `PgUserRepository`         |

**Pre-discussion artifact:** `.planning/phases/999.10.1-hexagonal-naming-convention-refactor/999.10.1-NOTES.md` (full dialogue snapshot + 2 research reports + locked decisions + open questions)

**Estimated scope:** ~50-80 files modified (field renames across 4 services × 3 layers × N RPCs; docs updates: CLAUDE.md + `.planning/codebase/ARCHITECTURE.md` + `.agents/skills/nestjs-hexagonal-mapping/references/NAMING.md`). Comparable to Phase 999.10 sweep size but mechanical (rename-only).

**Requirements:** Locked decisions above serve as primary requirement surface (no REQ-IDs; naming convention refactor per user dialogue 2026-04-19).
**Plans:** 5/5 plans complete

Plans:

- [x] 999.10.1-01-PLAN.md — auth pilot (6 controller + 4 use-case Repository field renames; services 6/6 already compliant) — PASSED (2 atomic commits 16c52f3 + e6ab119; dual-mode runtime smoke native + isolated HTTP 200 5/5 upstreams up; 13/13 structural grep invariants PASS on auth slice)
- [x] 999.10.1-02-PLAN.md — sender sweep (10 controller + 4 use-case Repository + 10 service UseCase field renames per D-19) — PASSED (3 atomic commits 06f6889 + 4ceaf24 + 11235dd; dual-mode runtime smoke native + isolated HTTP 200 5/5 upstreams up; 18/18 structural grep invariants PASS; D-19 strict composed rule validated — pause/resume both use transitionCampaignStatus)
- [x] 999.10.1-03-PLAN.md — parser sweep (7 controller incl. 2 edge-case type-stem derivations + 3 use-case Repository + 7 service UseCase incl. 1 dual-field service) — PASSED (3 atomic commits d532800 + 6aa600e + 8e3b417; dual-mode runtime smoke native + isolated HTTP 200 5/5 upstreams up + `/test/parser/storage-service` `allPassed:true` both buckets; 29/29 structural grep invariants PASS on parser slice; D-01 A.edge rule first empirically validated — runStorageSmokeService/cleanupStorageSmokeService derived from TYPE STEM, NOT short form; D-19 strict dual-field rule second application on run-storage-smoke.service.ts)
- [x] 999.10.1-04-PLAN.md — audience sweep (8 controller collision-showcase + 7 use-case Repository with D-20 atomic underscore drop + 8 service UseCase incl. shared TransitionRecipientsStatusUseCase) — PASSED (3 atomic commits 20a758b + fd61e45 + 071e96b; dual-mode runtime smoke native + isolated HTTP 200 5/5 upstreams up; 32/32 structural grep invariants PASS on audience slice + phase-level rollup; D-16 collision showcase validated — `listGroupsService: ListGroupsPort` resolves method↔field clash; D-20 atomic underscore drop realised — 0 `_\w+` fields in audience application layer; D-19 strict third real-world application — mark-as-sent + reset-send-status both use `transitionRecipientsStatus` from shared TransitionRecipientsStatusUseCase; PHASE-LEVEL INVARIANTS ALL GREEN: 0 Port-fields / 31 Service-fields / 18 Repository-fields / 0 underscores workspace-wide)
- [x] 999.10.1-05-PLAN.md — docs finalization (atomic 6-file commit 58ea450 per D-13/D-14/D-22: CLAUDE.md + ARCHITECTURE.md + NAMING.md + EXAMPLES.md + DO-DONT.md + SKILL.md; NAMING.md gains ~170-line "## Field Naming Rules (Phase 999.10.1)" section with 7 sub-blocks a-g incl. 3 worked examples + 6-author reference split table + Clean Code ch.2 Hungarian anti-pattern citation; DO-DONT.md adds anti-pattern #10 with grep detector; SKILL.md D-22 mini-update; 12 Task 1 grep invariants + 4 phase-level D-01/D-02/D-04/D-20 invariants all PASS; pnpm lint 7/7 + pnpm build 10/10 cached green; Task 2 human-verify deferred to /gsd:verify-work 999.10.1; PHASE 999.10.1 ARCHITECTURALLY COMPLETE — all 22 D-\* decisions D-01..D-22 realised)

### Phase 999.11: infra-abstraction-audit-smoke-cleanup

**Goal:** Remove all `/test/*` production endpoint code (smoke/test endpoints, controllers, modules) from `apps/gateway`, `apps/parser`, `apps/notifier`, plus the backing gRPC smoke RPCs in `packages/contracts/proto/{parser,notifier}.proto`. Scope narrowed during `/gsd:discuss-phase` (2026-04-19) from the original "audit + cleanup" to deletion-only (Area 1); architecture audit / canonical-reference work deferred to Phases 999.12–999.15. Full context in `.planning/phases/999.11-infra-abstraction-audit-smoke-cleanup/999.11-CONTEXT.md` and `.planning/notes/2026-04-19-infra-consistency-discussion.md`.
**Depends on:** Phase 999.10.1
**Requirements:** D-01..D-07 (locked decisions in 999.11-CONTEXT.md serve as requirement surface — no REQ-IDs in REQUIREMENTS.md; this is a deletion phase)
**Plans:** 4/4 plans complete

Plans:

- [x] 999.11-01-PLAN.md — Gateway smoke removal (3 atomic commits: storage-smoke + http-smoke + grpc-client-sanity; OQ-1 resolution deletes infrastructure/clients/http-smoke/ atomically)
- [x] 999.11-02-PLAN.md — Parser backend smoke hexagonal slice deletion (1 atomic commit d5db160: 9 application files + 3 infrastructure edits — 12 file ops; parser.controller.ts keeps throwing stubs until Plan 04 regenerates ParserProto.ParserServiceController; D-06 per-commit gate green pnpm lint 7/7 + pnpm build 10/10; bisect-safe)
- [x] 999.11-03-PLAN.md — Notifier backend smoke deletion (1 atomic commit f78d74e: 2 file changes — 1 edit + 1 delete; asymmetric scope confirmed empirically pre-edit — no hexagonal slice existed to remove per RESEARCH.md Pitfall 2; StorageSmokeController + @GrpcMethod handlers for NotifierService.RunStorageSmoke/CleanupStorageSmoke gone from runtime; TelegramSmokeController preserved per D-03; D-06 per-commit gate green pnpm lint 7/7 + pnpm build 10/10)
- [x] 999.11-04-PLAN.md — Proto edits + ts-proto regeneration + parser.controller.ts stub removal (1 atomic commit fb23e24: 5 file changes — 2 proto edits + 2 regenerated .ts + 1 controller stub removal; -782/+17 line delta; parser.proto 100→68 lines with 6 RPCs; notifier.proto 45→14 lines with HealthCheck-only per Pitfall 3; generated/parser.ts 1030→687; generated/notifier.ts 418→80; D-06 per-commit gate green pnpm lint 7/7 + pnpm build 10/10) + D-07 dual-mode runtime smoke gate PASSED first try (native HTTP 200 @~10s boot + isolated HTTP 200 @~50s boot, both with 5/5 upstreams up + 0 error/warn across 6 isolated containers). Workspace-wide grep for 9 smoke symbols = 0 matches. Security Invariants SI-1/SI-2/SI-3 all green. Phase 999.11 total = 6 atomic refactor commits per D-04; 0 deviations, 0 auto-fixes, 0 escalations.

### Phase 999.11.4: architecture-skill-vs-code audit (INSERTED)

**Goal:** Audit all 10 working project skills against current code state via Heavy verify-against-reality methodology with Directional Authority Taxonomy (AUTH/DESC/HYBRID), producing 999.11.4-AUDIT.md (per-skill sections + summary table) and 999.11.4-SOLUTIONS.md (1-3 ranked remediation options per finding) for user-approved sub-phase creation outside this phase.
**Requirements**: SPEC R1-R7 (locked in 999.11.4-SPEC.md — no REQ-IDs in REQUIREMENTS.md per CONTEXT.md frontmatter)
**Depends on:** Phase 999.11
**Plans:** 6/5 plans complete

Plans:

- [x] 999.11.4-00-PLAN.md — Phase-decision index build: parse all D-XX patterns from .planning/phases/_/{phase}-CONTEXT.md and _-SUMMARY.md across ~35 phases; group by skill topic-area; flag orphan decisions (D-04/D-05/D-06; Wave 1) ✅ 2026-04-22 (419 decisions across 22 phases + 227 orphans)
- [x] 999.11.4-01-PLAN.md — AUTH batch: 6 parallel sub-agents audit no-magic-values, twelve-factor, env-schema, infrastructure-guard, gsd-flow-guard, branching-patterns via grep-against-rules methodology; 7 atomic commits (1 scaffold + 6 per-skill); Wave 2 ✅ 2026-04-22 (4 findings: 2 nmv + 2 ig; 4 skills aligned)
- [x] 999.11.4-02-PLAN.md — DESC batch: 2 parallel sub-agents audit nestjs-hexagonal-mapping, infrastructure-client-layering via skill-vs-phase-decisions methodology using PHASE-DECISIONS-INDEX; 3 atomic commits (2 per-skill + 1 SUMMARY); Wave 3 ✅ 2026-04-22 (4 findings: nhm-F-03..04 + icl-F-01..02, all refresh-skill, 13 sanctioned D-XX xref, 0 ad-hoc drift)
- [x] 999.11.4-03-PLAN.md — HYBRID batch: 3 skills audited (rsv + coi + cdh) via per-section combo methodology; 4 atomic commits (3 per-skill + 1 SUMMARY); Wave 4 ✅ 2026-04-22 (8 findings: 2 rsv + 3 coi + 3 cdh, all DESC-section, 29 sanctioned D-XX xref + 1 ad-hoc drift; sequential-fallback Rule 3 deviation — Task tool unavailable in context, identical output contract preserved)
- [x] 999.11.4-04-PLAN.md — Synthesis: AUDIT.md finalisation (Orphan + Reclassification + Skipped sections + summary totals) + SOLUTIONS.md authoring (1-3 ranked variants per finding per Phase 999.1 precedent) + phase SUMMARY.md handoff doc; 4 atomic commits; Wave 5

### Phase 999.11.4.1: Refactor project skills from inventory-level to principles-level content — consolidated remediation for 11 refresh-skill findings in 999.11.4-SOLUTIONS.md (5 primary skills + 4 aligned-sweep skills; clean-ddd-hexagonal deferred to a separate sub-phase) (INSERTED)

**Goal:** Rewrite 5 primary project skills (`infrastructure-guard`, `nestjs-hexagonal-mapping`, `infrastructure-client-layering`, `runtime-smoke-verification`, `composition-over-inheritance`) from inventory-level content (specific file paths, port numbers, class names, enumerated counts) to timeless principles that survive the "rename test" — every assertion stays true after any referenced file/class/variable is renamed. Close the 11 refresh-skill findings from Phase 999.11.4 AUDIT (ig-F-01, ig-F-02, nhm-F-03, nhm-F-04, icl-F-01, icl-F-02, rsv-F-01, rsv-F-02, coi-F-01, coi-F-02, coi-F-03). Apply the universal D-4 header-rule block ("This skill describes timeless principles — do NOT add inventory") to every refactored SKILL.md (5 primary + 4 aligned = 9 total). Preventive aligned sweep over `twelve-factor`, `env-schema`, `gsd-flow-guard`, `branching-patterns` per D-12. Docs-only phase — zero changes in `apps/`, `packages/`, `infra/`.
**Requirements**: D-01..D-16 locked in 999.11.4.1-CONTEXT.md (no REQ-IDs in REQUIREMENTS.md per CONTEXT frontmatter); finding IDs ig-F-01..coi-F-03 serve as phase-local traceability anchors per D-16
**Depends on:** Phase 999.11.4
**Plans:** 6/6 plans complete

Plans:

- [x] 999.11.4.1-01-PLAN.md — Refactor `nestjs-hexagonal-mapping` SKILL.md + references (LAYERS.md + NAMING.md); close nhm-F-03 + nhm-F-04; DRAFTS the D-4 header-block wording + the abstract config-factory wording that Plans 02..06 reuse verbatim per D-10a (Wave 1, 3 tasks, 3 atomic commits + newcomer test) ✅ 2026-04-24
- [x] 999.11.4.1-02-PLAN.md — Refactor `infrastructure-client-layering` SKILL.md; reuse Plan 01's D-4 wording + config-factory wording byte-for-byte (D-10a pairing); close icl-F-01 (hand-rolled @Global() @Module({}) example replaced with abstract factory description) + icl-F-02 (split single-instance vs multi-instance-per-namespace sections) (Wave 2, 2 tasks, 2 atomic commits) ✅ 2026-04-24
- [x] 999.11.4.1-03-PLAN.md — Refactor `infrastructure-guard` SKILL.md; close ig-F-01 + ig-F-02 by DELETING the Standard Ports inventory table and replacing with role-based identifier-governance section pointing at tracked env templates + tracked compose infra configuration per D-5 + D-8 (Wave 3, 2 tasks, 2 atomic commits) ✅ 2026-04-24
- [x] 999.11.4.1-04-PLAN.md — Refactor `runtime-smoke-verification` SKILL.md §Project-Specific Note; close rsv-F-01 + rsv-F-02 by replacing specific pnpm-script enumeration + hard-coded gateway port with discovery commands against `package.json` and tracked env templates per D-5 + D-8 (Wave 4, 2 tasks, 2 atomic commits) ✅ 2026-04-24
- [x] 999.11.4.1-05-PLAN.md — Refactor `composition-over-inheritance` SKILL.md (largest findings-load — 3 findings); close coi-F-01 (Pattern 1 fictional example replaces deleted-code reference) + coi-F-02 (Application by Layer role-based + grep-on-demand) + coi-F-03 (Enforcement links to `.eslintrc.js` as authoritative source per D-6; static census replaced with grep command per D-8) (Wave 5, 2 tasks, 2 atomic commits) ✅ 2026-04-24
- [x] 999.11.4.1-06-PLAN.md — Aligned-sweep: apply D-4 header block + single rename-test pass to 4 zero-findings skills (`twelve-factor`, `env-schema`, `gsd-flow-guard`, `branching-patterns`); 4 per-skill atomic commits per D-11 extended via D-12 closing clause + 1 closure commit with per-skill newcomer-test record + phase-level invariant check (D-4 coverage across all 9 skills; SOLUTIONS.md = 11 ☑ Approved rows) (Wave 6, 5 tasks, 5 atomic commits) ✅ 2026-04-24

### Phase 999.11.3: nestjs-hexagonal-mapping skill refresh for inbound/outbound/bootstrap tree (INSERTED)

**Goal:** Обновить skill `nestjs-hexagonal-mapping` (SKILL.md + 6 references/\*.md) под канонический `infrastructure/{inbound,outbound,bootstrap}/` tree, зафиксированный в Phase 999.11.2. Plan 09 из 999.11.2 обновил только sibling-skill `infrastructure-client-layering`, этот скил пропустили — в результате CLAUDE.md указывает на `nestjs-hexagonal-mapping` как source of truth, но сам скил ссылается на устаревшие пути (`infrastructure/controllers/grpc/`, `infrastructure/persistence/`, `infrastructure/config/`, `infrastructure/clients/`). Scope: переписать пути по всем 7 файлам скила под 999.11.2 D-01..D-17, обновить §"Canonical Tree" и §"Composition Root" в LAYERS.md, актуализировать PROTO-VISIBILITY.md + DO-DONT.md #7 и #8, добавить gateway D-11a exception (нет root `{svc}.constants.ts`), cross-ref на `infrastructure-client-layering` §"Phase 999.11.2 refinement". **Принцип фазы:** каждое утверждение скила верифицируется grep/Read против текущего кода перед тем как считать рядом green — skill не должен расходиться с реальной структурой.
**Requirements**: D-01..D-08 (locked decisions in 999.11.3-CONTEXT.md serve as requirement surface — no REQ-IDs in REQUIREMENTS.md per CONTEXT.md frontmatter)
**Depends on:** Phase 999.11.2 (канонический tree landed) + Phase 999.11.1 D-08 (bootstrap/config slice shape)
**Plans:** 2/2 plans complete

Plans:

- [x] 999.11.3-01-PLAN.md — Refresh core skill surface: SKILL.md + LAYERS.md with canonical inbound/outbound/bootstrap paths, full §Canonical Tree rewrite, 3 new parent sections (§Bootstrap, §Inbound, §Outbound), gateway D-11a exception documented (Wave 1, atomic commit)
- [ ] 999.11.3-02-PLAN.md — Refresh 5 references/\*.md + bidirectional cross-ref with infrastructure-client-layering + write 999.11.3-VERIFICATION.md + flip VALIDATION.md nyquist_compliant flag (Wave 2, atomic commit)

### Phase 999.11.2: infrastructure-tree-canonical-split (INSERTED)

**Goal:** Refactor `apps/{svc}/src/infrastructure/` across all 6 microservices into canonical `inbound/`/`outbound/`/`bootstrap/` split per Cockburn primary/secondary adapters + Uncle Bob Ring 3/Ring 4 + Graca Explicit Architecture. Feature-slicing per direction (per aggregate / upstream / vendor / cross-cutting concern). Create HealthModule across all 6 services (D-08). Move {SVC}\_CONFIG into bootstrap/config/ (D-10). Delete empty gateway.constants.ts (D-11a). Refine CLAUDE.md §NestJS↔Hexagonal Layer Mapping + .eslintrc.js Override 6/7/9 paths + infrastructure-client-layering skill. D-14 dual-mode smoke gate at phase end per 999.11.1 precedent. Behavior-preserving — no business logic, no tests. ~65 file moves + ~36 creates + 1 delete + 5 empty-dir cleanups.
**Requirements**: D-01..D-17 (locked decisions in 999.11.2-CONTEXT.md serve as primary requirement surface — no new REQ-IDs in REQUIREMENTS.md)
**Depends on:** Phase 999.11
**Plans:** 10/10 plans complete

Plans:

- [ ] 999.11.2-01-PLAN.md — Migrate auth service (template for plans 02-06; 1 aggregate, 1 proto, 0 cross-app clients; Commit 1)
- [ ] 999.11.2-02-PLAN.md — Migrate audience service (2 aggregates, 1 gRPC upstream; first multi-sub persistence composer; Commit 2)
- [ ] 999.11.2-03-PLAN.md — Migrate sender service (1 aggregate, 1 gRPC upstream, 1 HTTP vendor; three outbound composer categories; Commit 3)
- [ ] 999.11.2-04-PLAN.md — Migrate parser service (1 aggregate, 1 gRPC upstream, 1 HTTP vendor, storage double-module split bucket+reports per DC-06; Commit 4)
- [ ] 999.11.2-05-PLAN.md — Migrate notifier service (RMQ inbound, HTTP telegram, storage reports; classify external/messaging/storage anomalous dirs; Commit 5)
- [ ] 999.11.2-06-PLAN.md — Migrate gateway service (5 gRPC upstreams, throttle, D-11a gateway.constants.ts delete; highest import-volume, done last; Commit 6)
- [ ] 999.11.2-07-PLAN.md — Refine CLAUDE.md §NestJS↔Hexagonal Layer Mapping per RESEARCH §8 draft (D-15; Commit 7)
- [ ] 999.11.2-08-PLAN.md — Update .eslintrc.js Override 6/7/9 paths per RESEARCH §9 draft (D-16; Commit 8)
- [ ] 999.11.2-09-PLAN.md — Verify/refine infrastructure-client-layering skill §Config for bootstrap/config/ + flip VALIDATION.md D-01..D-13,D-15..D-17 rows green (D-17; Commit 9)
- [ ] 999.11.2-10-PLAN.md — D-14 dual-mode smoke gate (native + isolated) + phase SUMMARY.md with 10 commit SHAs + nyquist_compliant flag flip (D-14; Commit 10)

### Phase 999.11.1: architecture-compliance-audit-and-fix (INSERTED)

**Goal:** Полный архитектурный аудит 6 сервисов + packages/foundation на соответствие NestJS↔Hexagonal mapping (CLAUDE.md), twelve-factor skill'у, env-schema skill'у и domain purity — с немедленным исправлением найденных нарушений в рамках этой же фазы (audit-and-fix mode). Известные нарушения на момент вставки: (1) `gateway/src/health/health.controller.ts` + `notifier/src/health/health.controller.ts` в неправильном месте — должны быть в `infrastructure/controllers/rest/`; (2) три smoke-контроллера (`notifier/telegram-smoke`, `sender/cloudfn-smoke`, `parser/appstorespy-smoke`) в `src/test/` вместо `infrastructure/controllers/{grpc,rest}/`; (3) все 4 `apps/*/drizzle.config.ts` используют `process.env.DATABASE_URL!` напрямую — нарушение twelve-factor и env-schema, должно идти через Zod config. Scope расширяется в research: полная матрица controllers placement + все `process.env` usages вне `packages/config` и `main.ts` + domain purity + proto visibility + feature-модули. Должно закрыть архитектурный долг ДО начала canonical-alignment фаз (999.12–999.15). **Absorbed the original Phase 999.2 scope** — canonical per-service `{SVC}_CONFIG` Symbol pattern + `@nestjs/config` full replace landed here.
**Requirements:** D-01..D-15 (locked decisions in 999.11.1-CONTEXT.md serve as primary requirement surface — no new REQ-IDs in REQUIREMENTS.md)
**Depends on:** Phase 999.11
**Plans:** 10/10 plans complete

Plans:

- [x] 999.11.1-01-PLAN.md — Register {SVC}\_CONFIG Symbols + providers in all 6 services (dormant, D-08)
- [x] 999.11.1-02-PLAN.md — Relocate 2 health controllers (gateway + notifier) to infrastructure/controllers/rest (D-05)
- [x] 999.11.1-03-PLAN.md — Relocate ThrottleModule to infrastructure/throttle + migrate to GATEWAY_CONFIG (D-06, first real consumer)
- [x] 999.11.1-04-PLAN.md — Foundation narrow-config migration: cache + persistence + logging + storage (D-10, IC-01..IC-03, IC-07, IC-08)
- [x] 999.11.1-05-PLAN.md — Foundation gRPC narrow config + cascade 5 client modules + delete obsolete GrpcClientModule (D-10, IC-04, DC-01)
- [x] 999.11.1-06-PLAN.md — Foundation HTTP narrow config + cascade 3 vendor modules (D-10, IC-06, IC-10..IC-12)
- [x] 999.11.1-07-PLAN.md — drizzle.config.ts env-hygiene fix (4 files atomic, D-07, TF-01..TF-04)
- [x] 999.11.1-08-PLAN.md — Delete 3 smoke controllers + module cleanups (D-03/D-04, NH-04..NH-06)
- [x] 999.11.1-09-PLAN.md — Remove @nestjs/config — delete AppConfigModule + scrub deps across workspace (D-11)
- [x] 999.11.1-10-PLAN.md — Update ROADMAP + skill docs; mark 999.2 absorbed; D-15 dual-mode smoke gate

### Phase 999.12: redis-canonical-alignment

**Goal:** Align Redis CacheModule with the canonical infra-client pattern (symmetry with gRPC post-999.7.x + persistence) and roll the structural cache adapter into all 6 services (auth, sender, audience, parser, notifier, gateway). Sender migrates `CacheModule.forRootAsync` from `bootstrap/health/` to a new `outbound/cache/cache.module.ts` thin app-level wrapper; the other 5 services receive the same wrapper + env schema spread + CACHE_CONFIG_PORT slice + REDIS_HEALTH inject. Gateway gains the single concrete business binding — `@nestjs/throttler` storage migrated from in-memory to Redis-backed via `@nest-lab/throttler-storage-redis@^1.2.0`, closing the distributed rate-limit gap. ESLint Override 4 forbids raw `ioredis` import in `apps/*/src/**`. CLAUDE.md §"NestJS↔Hexagonal Layer Mapping" matrix gets a new Cache adapter row (D-09); Phase 21 D-02 receives an inline rate-limit-partial-unlock amendment in CONTEXT.md (D-16). Full context in `999.12-CONTEXT.md` (20 D-decisions); research and pattern map in `999.12-RESEARCH.md` + `999.12-PATTERNS.md`.
**Requirements:** Tracked via decision IDs D-01..D-20 in CONTEXT.md (no explicit REQ-IDs in ROADMAP). Distributes across 11 plans per `decisions_addressed` frontmatter field.
**Plans:** 11 plans

Plans:

- [x] 999.12-01-PLAN.md — ESLint Override 4 forbids raw ioredis import in apps/\*/src/\*\* (D-08)
- [x] 999.12-02-PLAN.md — Foundation REDIS_CLIENT export amendment for D-13 throttle storage (Phase 21 D-04 narrowly amended; D-07/D-13)
- [x] 999.12-03-PLAN.md — Compose RedisSchema.shape into 5 env schemas (auth/audience/parser/notifier/gateway, D-15)
- [x] 999.12-04-PLAN.md — Sender migration: CacheModule from bootstrap/health/ to outbound/cache/ (D-02/D-03/D-04/D-05)
- [x] 999.12-05-PLAN.md — Auth structural cache rollout (D-02/D-03/D-15/D-20)
- [x] 999.12-06-PLAN.md — Audience structural cache rollout (D-02/D-03/D-15/D-20)
- [x] 999.12-07-PLAN.md — Parser structural cache rollout (D-02/D-03/D-15/D-20; multi-indicator readiness preserved)
- [x] 999.12-08-PLAN.md — Notifier structural cache rollout (D-02/D-03/D-15/D-20; mixed DI styles preserved per S-5)
- [x] 999.12-09-PLAN.md — Gateway structural cache rollout + root AppCacheModule import before ThrottleModule (D-02/D-03/D-12/D-15/D-20)
- [x] 999.12-10-PLAN.md — Gateway throttle migration to Redis-backed ThrottlerStorageRedisService (D-13/D-16)
- [x] 999.12-11-PLAN.md — Docs propagation: CLAUDE.md Cache adapter row + Phase 21 CONTEXT.md inline amendment (D-09/D-16)

### Phase 999.12.1: infra-naming-convention-audit (INSERTED)

**Goal:** Audit naming convention across 4 backing-service abstractions (cache, persistence, storage, future rabbitmq) and fix Tier-1 drift. Storage layer (post-Phase 22.x) is the canonical reference baseline — abstract domain-role names on health/service/config tokens (`*_STORAGE_HEALTH`, `STORAGE_CORE_CONFIG_PORT`), tech-specific only on raw library instances (`S3_CLIENT`) and library defaults (`S3_DEFAULTS`). Cache layer drifts: `REDIS_HEALTH` token binds abstract `CacheHealthIndicator` — must be renamed to `CACHE_HEALTH` for symmetry with `DATABASE_HEALTH`/`*_STORAGE_HEALTH`. Persistence has one orthogonal misplacement (`COLUMN_LENGTH` lives in pg-pool constants but is generic VARCHAR semantics). Skill `infrastructure-client-layering` SKILL.md gets explicit Tier-1/2/3 convention section with storage as worked example, locking convention before 999.13 (RabbitMQ) writes new naming surface. Full pre-discussion analysis in `999.12.1-NOTES.md` — discuss-phase starts from there.
**Requirements**: D-01..D-14 (locked via /gsd:discuss-phase 2026-04-28; CONTEXT.md is the requirements set for this structural-rename phase)
**Depends on:** Phase 999.12
**Plans:** 8/8 plans complete

Plans:

- [x] 999.12.1-01-PLAN.md — Cache token rename: REDIS_HEALTH → CACHE_HEALTH + 6 health.controllers field redis → cache (D-04)
- [x] 999.12.1-02-PLAN.md — Persistence token+type rename: DATABASE_HEALTH → PERSISTENCE_HEALTH + DatabaseHealthIndicator → PersistenceHealthIndicator + field db → persistence in 4 controllers (D-05)
- [x] 999.12.1-03-PLAN.md — Storage token rename: PUBLIC_BUCKET_HEALTH → PUBLIC_STORAGE_HEALTH + notifier field publicBucket → publicStorage (D-06)
- [x] 999.12.1-04-PLAN.md — Messaging migration: RabbitMqHealthIndicator → MessagingHealthIndicator + Symbol-DI promotion + new external/messaging/ folder + locks 999.13 convention (D-08, D-09)
- [x] 999.12.1-05-PLAN.md — HEALTH.INDICATOR keys rename: REDIS/RABBITMQ/POSTGRESQL → CACHE/MESSAGING/PERSISTENCE (D-07)
- [x] 999.12.1-06-PLAN.md — COLUMN_LENGTH extraction to column-length.constants.ts (orthogonal concern from PG-specific constants) (D-10)
- [x] 999.12.1-07-PLAN.md — Codify Tier 1/2/3 framework + layer-name axis in skill SKILL.md (fictional names per 999.11.4.1 D-3) + CLAUDE.md inventory updates (D-14, D-01, D-02, D-03)
- [x] 999.12.1-08-PLAN.md — Final phase-gate verification: dual-mode runtime smoke (pnpm start:native + pnpm start:isolated) + 14 D-IDs coverage matrix in SUMMARY.md (D-01..D-14 all realised)

### Phase 999.13: rabbitmq-canonical-abstraction (BACKLOG)

**Goal:** Build RabbitMQ client abstraction following gRPC canonical reference from 999.11 — foundation primitive (connection factory, channel lifecycle, publish/consume helpers), per-service modules in `apps/*/src/infrastructure/messaging/`, Symbol DI tokens, real `RabbitMqHealthIndicator` replacing current stub. Possibly merges with Phase 25 EventModule (or precedes it as canonical-pattern prerequisite). Full context in `.planning/notes/2026-04-19-infra-consistency-discussion.md` §"Phase 999.13".
**Requirements:** TBD
**Plans:** 0 plans

Plans:

- [ ] TBD (promote with /gsd:review-backlog when ready)

### Phase 999.14: s3-canonical-audit (BACKLOG)

**Goal:** Audit Phase 22/22.1 S3 StorageModule setup against gRPC canonical reference from 999.11 — confirm S3CoreModule + BucketStorageModule.forBucket + per-bucket health tokens + foundation external/internal encapsulation + ESLint 3-gate protection as "second sibling pattern", or realign minor details. Likely near-no-op (S3 is the most mature infra abstraction), but audit clarifies universal-vs-gRPC-specific canonical pattern. Full context in `.planning/notes/2026-04-19-infra-consistency-discussion.md` §"Phase 999.14".
**Requirements:** TBD
**Plans:** 0 plans

Plans:

- [ ] TBD (promote with /gsd:review-backlog when ready)

### Phase 999.15: production-health-contract-ci-smoke (BACKLOG)

**Goal:** Establish production health contract 3-tier (`/health/live` + `/health/ready` + optional `/health/startup`) across all 6 services, covering all infra deps via shallow checks (PG SELECT 1, Redis PING, S3 HeadBucket, RMQ channel status, gRPC upstream health). Move deep CRUD validation to CI post-deploy smoke job (GitHub Actions workflow + shell scripts per infra system) with Telegram alerts via existing notifier. Finalization phase after all infra abstractions aligned (999.11 → 999.12 → 999.13 → 999.14). Deferred: external synthetic monitoring (Datadog/Checkly), auto-rollback via Coolify API, scheduled continuous probes. Full context in `.planning/notes/2026-04-19-infra-consistency-discussion.md` §"Phase 999.15".
**Requirements:** TBD
**Plans:** 0 plans

Plans:

- [ ] TBD (promote with /gsd:review-backlog when ready)

### Phase 999.16: s3-garage-connectivity-isolated-mode-fix (BACKLOG)

**Goal:** Fix S3 (Garage) connectivity in isolated mode — `parser /health/ready` and `notifier /health/ready` return HTTP 503 because `s3:parser` and `s3:public` health checks fail with "S3 storage connection failed". All other dependencies (cache, persistence, messaging) report `up`. Discovered during `/gsd:verify-work 999.12.1` runtime probing (Test 4b evidence in `999.12.1-UAT.md`). Pre-existing infrastructure issue, unrelated to Tier-1 Symbol token renames of 999.12.1. Investigation needed: Garage container status in isolated mode (`infra-garage-*`), S3 endpoint config drift between native and isolated profiles, network reachability from `infra-parser-1`/`infra-notifier-1`, credentials/access-key validity. Affects parser and notifier readiness probes only — services functional but degraded (gateway aggregator still shows them up via gRPC liveness, but per-service HTTP `/health/ready` returns 503).
**Requirements:** TBD
**Plans:** 0 plans

Plans:

- [ ] TBD (promote with /gsd:review-backlog when ready)

### Phase 999.17: devsecops-shift-left-security-tooling (BACKLOG)

**Goal:** Внедрить трёхслойную систему security-проверок проекта на разных стадиях разработки. **Слой 1 — pre-commit (husky + lint-staged):** быстрая (<5s) проверка на staged файлах — gitleaks (secrets), ESLint+Prettier (lint+format). **Слой 2 — pre-push:** инкрементальные проверки (10-30s) на изменения относительно origin/main — Semgrep (SAST для NestJS/TS), `pnpm audit` при изменении lock-файла, Trivy config при изменении Dockerfile/compose. **Слой 3 — CI required gate (GitHub Actions, branch protection):** полный прогон gitleaks + Semgrep + Trivy fs (SCA + license) + Trivy config (Dockerfile + docker-compose) + Trivy image (после build) + Syft (SBOM artifact). Quality Gate с thresholds: HIGH/CRITICAL CVE → block merge, new secret detected → block, SAST HIGH+ → block. Принцип: hooks дают разработчику быстрый фидбек (можно обойти `--no-verify`), CI работает как обязательный gate (нельзя обойти при включённой branch protection). **Lean stack:** gitleaks, Semgrep, Trivy (3 режима — fs/config/image), Syft, husky 9, lint-staged. **Rejected during analysis:** SonarQube (80%+ overlap с Semgrep, тяжёлая инфраструктура — своя БД/сервер/лицензия для приватных репо), отдельный SCA tool помимо Trivy (Trivy fs покрывает npm SCA + license check). **Scope (in):** dev hooks (pre-commit, pre-push), CI workflows (`.github/workflows/security.yml`), Quality Gate config с thresholds, husky setup, документация локального запуска проверок. **Scope (out, devops layer):** continuous Trivy rescan продакшен-образов по cron (CVE feed обновляется ежедневно — нужен scheduled scanner), runtime security (Falco/Wiz/Aqua), DAST (ZAP/Burp), secrets management в проде (Vault/SOPS), WAF/IDS/IPS, k8s admission controllers. **Scope (deferred to separate phase):** Renovate/Dependabot для автоматических dep updates (это про процесс мерджа автоПР, не про сами scanners). **Open questions для discuss-phase:** (1) husky уже стоит в репо или ставим с нуля (проверить package.json + .husky/); (2) Renovate vs Dependabot — нативный для GitHub vs гибче для monorepo; (3) точные thresholds Quality Gate — только CRITICAL block или HIGH+ тоже; (4) pre-commit hook нужен или только CI (локальные hooks ловят секреты до push, но требуют дисциплины разработчика). Discovered 2026-04-28 после завершения Phase 999.12.1 в discussion на тему DevSecOps practices for the project.
**Requirements:** TBD
**Plans:** 12/12 plans complete

Plans:

- [x] 999.17-01-PLAN.md — pnpm 9 → 11 bump (D-11 prerequisite)
- [x] 999.17-02-PLAN.md — lint-staged install + .lintstagedrc.json (D-01, D-12)
- [x] 999.17-03-PLAN.md — .gitleaks.toml + .gitleaksignore (D-03, D-09, D-14, D-16)
- [x] 999.17-04-PLAN.md — .semgrep.yml + .semgrepignore (D-13, D-09, D-14, D-16)
- [x] 999.17-05-PLAN.md — .trivyignore (D-09, D-14, D-16)
- [x] 999.17-06-PLAN.md — pre-commit hook + security:secrets-staged (D-01, D-02, D-03)
- [x] 999.17-07-PLAN.md — pre-push hook + security:\* chain (D-01, D-02, D-06, D-10, D-13)
- [x] 999.17-08-PLAN.md — renovate.json (D-08)
- [x] 999.17-09-PLAN.md — DEVOPS-HANDOFF.md + .gitlab-ci-security.yml.example (D-04, D-05, D-07, D-15)
- [x] 999.17-10-PLAN.md — End-to-end smoke + STATE.md closure
- [x] 999.17-11-PLAN.md — GAP-CLOSURE: restore working build-script trust gate (CR-01 — strictDepBuilds:true + exhaustive allowBuilds + Plan 02 SUMMARY correction)
- [x] 999.17-12-PLAN.md — GAP-CLOSURE: fix gitleaks allowlist regex blind spot (CR-02 — delete unanchored allowlist; rely on useDefault path exclusions)
