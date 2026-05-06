# Email Platform

## What This Is

Монорепозиторная email-платформа на базе NestJS микросервисов. 6 сервисов (gateway, auth, sender, parser, audience, notifier) и 3 shared-пакета (config, foundation, contracts). Clean/Hexagonal архитектура во всех сервисах с чёткими границами слоёв.

## Core Value

Каждый сервис должен быть изолированным, с чёткими границами, единым источником истины и правильными контрактами — чтобы бизнес-логика могла строиться на надёжном фундаменте без переделок.

## Current Milestone: v4.0 Infrastructure Abstractions & Cross-Cutting

**Goal:** Унифицированные абстракции для всей инфраструктуры — каркасы в foundation, per-service адаптеры — с изоляцией сервисов от знаний об инфраструктуре, в стиле Clean/Hexagonal.

**Target features:**

- gRPC client каркас в foundation + per-service адаптеры в infrastructure/clients/
- RabbitMQ publisher/consumer абстракция + per-service конфигурация
- HTTP client каркас для внешних API + per-service адаптеры
- S3 client через AWS SDK (unified MinIO/Garage, env rename MINIO*\* → S3*\*)
- Redis client в едином стиле
- Distributed tracing (propagation через gRPC metadata, RabbitMQ headers)
- Graceful shutdown (корректное завершение connections, in-flight запросов)
- Circuit breaker для внешних HTTP вызовов
- Config decomposition (модульная env-schema)

## Requirements

### Validated

- ✓ Монорепозиторий с pnpm workspace — existing
- ✓ 6 NestJS микросервисов с gRPC коммуникацией — existing
- ✓ REST gateway как единая точка входа — existing
- ✓ RabbitMQ для асинхронной коммуникации — existing
- ✓ Shared packages: config (Zod), foundation (gRPC clients, logging, errors), contracts (proto) — existing
- ✓ Docker Compose инфраструктура (MongoDB, Redis, RabbitMQ, MinIO) — existing
- ✓ Health checks по gRPC протоколу — existing
- ✓ Structured logging через Pino с correlation IDs — existing
- ✓ Retry/resilience для gRPC подключений — existing
- ✓ Единый источник сгенерированных контрактов (src/generated/ only) — Phase 1
- ✓ Proto генерация в Turbo pipeline с кэшированием — Phase 1
- ✓ Команда `pnpm generate:contracts` на верхнем уровне — Phase 1
- ✓ Config через DI (ConfigService), loadGlobalConfig только в main.ts — Phase 2
- ✓ CORS wildcard запрещён в production (Zod refine) — Phase 2
- ✓ MinIO credentials через env var substitution — Phase 2
- ✓ Metadata bug fix (optional chaining, оба места) — Phase 3
- ✓ Error sanitization по gRPC code, safe messages для клиентов — Phase 3
- ✓ Unified error shape `{ statusCode, message, error, correlationId, timestamp }` — Phase 3

- ✓ Auth service: Clean/Hexagonal reference (domain/application/infrastructure) — Phase 4

- ✓ All services: Clean/Hexagonal scaffolding (sender 11, parser 6, audience 9 gRPC stubs) — Phase 5
- ✓ Notifier: event-consumer-only с RabbitMQ health indicator — Phase 5
- ✓ Gateway: infrastructure/clients layer (REST facade) — Phase 5
- ✓ Zero cross-service imports enforced — Phase 5

- ✓ Parallel gateway health via Promise.allSettled — Phase 6
- ✓ Retry tuned (5/200ms/5s + jitter + env vars) — Phase 6
- ✓ Liveness/readiness separation, per-service dependency checks — Phase 6

- ✓ Docker Compose split (infra + full-stack), env sync, NODE_ENV removal — Phase 15
- ✓ GitHub Actions CI: lint + typecheck + build on every PR, Turbo affected-only + cache — Phase 16
- ✓ Docker port isolation: infra ports only in dev-ports override, gateway-only in full Docker — Phase 16.1
- ✓ Docker images built per service via matrix, pushed to GHCR with branch-aware tags — Phase 17
- ✓ DI double registration fix: single PG pool per service — Phase 17.1
- ✓ No-magic-values skill + full codebase audit — Phase 17.2
- ✓ Coolify deployment: dev + prod environments, PostgreSQL, Redis, RabbitMQ, Garage S3 — Phase 18
- ✓ CI push-based deploy: GitHub Actions → Coolify API, 1 deploy per merge — Phase 18.1
- ✓ Garage S3 with WebUI, buckets and keys for dev + prod — Phase 18.1
- ✓ Build-info.json baked into Docker images (commit, branch, timestamp) — Phase 19
- ✓ Both dev modes verified: start:native + start:isolated — Phase 19
- ✓ Config decomposition: modular Zod sub-schemas, per-service env validation — Phase 20
- ✓ Redis CacheModule: DI-injected client, CachePort абстракция, auto-prefix namespace, real health check — Phase 21
- ✓ S3 StorageModule: DI-injected S3CoreModule singleton (non-global, self-contained inside BucketStorageModule.forBucket) + per-bucket health tokens, ReportsStorageModule as shared Nest module in foundation, STORAGE_PROTOCOL env var (works identically MinIO/Garage) — Phase 22, Phase 22.1
- ✓ Foundation package encapsulation: `external/` vs `internal/` partition with package.json `exports` field + tsconfig `moduleResolution: node16` + ESLint two-override rule — three independent gates seal public/internal API, S3CoreModule reachable only via `@email-platform/foundation/internal` subpath — Phase 22.1
- ✓ gRPC client `Promisified<T>` Proxy primitive: foundation provides single mapped-type Proxy factory replacing 8 hand-written per-method wrapper classes + standalone `GrpcCaller` helper; consumers `@Inject(SERVICE.x.diToken)` and get `Promisified<XxxProto.XxxServiceClient>` typed Promise-returning client directly without apps-level boilerplate; logging temporarily removed (singleton `PinoLogger.root` anti-pattern; future observability phase will return via DI-injected logger in outer Proxy chain) — Phase 999.7.3
- ✓ Smoke/test surface area removed: all `/test/*` production endpoints deleted from gateway (storage-smoke + http-smoke orphan), parser backend storage-smoke hexagonal slice deleted (9 application files + partial controller/module/constants edits), notifier storage-smoke controller deleted, parser.proto + notifier.proto edited (2 RPCs + 5 message types each removed, NotifierService becomes HealthCheck-only), ts-proto regenerated; 6 atomic commits in consumer-first order; D-07 dual-mode runtime smoke gate passed (native + isolated, 5/5 upstreams up each) — Phase 999.11
- ✓ Config System Audit (docs-only, independent phase): canonical 7-level config system design LOCKED (`999.1-DESIGN.md` — 8 level sections Level 0..Level 7, 29 invariants I-0.1..I-7.4, cross-ref matrix invariant↔skill↔layer), full 5-layer findings catalogue (`999.1-AUDIT.md` — 14 F-NN: 2 blocker / 6 major / 6 minor, inline fenced evidence, 3-tier severity), per-finding migration variants (`999.1-SOLUTIONS.md` — 14 × 3 variants = 42, 7-col trade-off tables, cross-F-NN deps, 7 pre-assigned sub-phase groupings 999.1.1..999.1.7, Backlog Impact flagging 999.1 TopologySchema as redundant + 999.4/999.5 keep/merge candidates), grep-proof verification (`999.1-VERIFICATION.md` — 63 V-NN rows, 37 ✅ / 26 ⚠️-as-F-NN / 0 ❌, `scripts/check-env-parity.sh` invoked), phase SUMMARY with D-14 handoff reminder. User's next step: review SOLUTIONS.md, flip approval checkboxes per F-NN, invoke `/gsd:insert-phase 999.1.N` per approved grouping — Phase 999.1
- ✓ Config Mechanism Consolidation (inline amend of Phase 999.1 post-close gaps F-15 + F-16): `loadConfig` relocated to `packages/foundation/src/external/config/load-config.ts` (now sole canonical `process.env` boundary), new foundation-owned `createConfigModule<TEnv>({schema, token, narrowPorts})` factory symmetric to gRPC `defineGrpcClient` precedent, 6/6 services migrated from hand-rolled `@Global() @Module({}) static forRoot()` to factory call, 6× `{svc}-config.provider.ts` files deleted, 4× `drizzle.config.ts` migrated to `loadConfig` (0 direct `process.env` reads in `apps/`), `packages/config/src/config-loader.ts` deleted + re-export removed; 999.1 artefacts inline-amended to 16 F-NN (F-15 blocker L3, F-16 major L4) + 30 invariants (I-0.1 reworded to «no CLI exception», new I-3.5 «foundation owns config DI factory»); 999.1-VALIDATION.md frontmatter reflipped back to `status: complete` / `nyquist_compliant: true` after re-verification; dual-mode runtime smoke gate passed (`pnpm start:native` + `pnpm start:isolated`, both HTTP 200 `/health/ready` + 5/5 upstreams up + 0 ERROR/WARN/FATAL); Phase 999.1.8 inserted between 999.1 and 999.1.1..999.1.7 (renumbered from slot originally reserved by 999.1 SOLUTIONS.md for F-01 TopologySchema refactor) — Phase 999.1.8

### Active

- [ ] gRPC client каркас в foundation + per-service адаптеры
- [ ] RabbitMQ publisher/consumer абстракция + per-service конфигурация
- [ ] HTTP client каркас для внешних API + per-service адаптеры
- [ ] Redis client в едином стиле с остальными infrastructure modules
- [ ] Distributed tracing (propagation через gRPC metadata, RabbitMQ headers)
- [ ] Graceful shutdown (корректное завершение connections, in-flight запросов)
- [ ] Circuit breaker для внешних HTTP вызовов
- [ ] Config decomposition (модульная env-schema вместо монолитной)

### Out of Scope

- Реализация бизнес-логики в сервисах — сначала фундамент, потом бизнес-логика
- Написание тестов — запланировано на следующий этап
- Frontend — не в скоупе этого проекта
- Добавление новых сервисов — работаем с тем что есть
- DDD в packages/ — это утилитарные библиотеки, DDD там излишний

## Context

- Shipped v3.0: полный CI/CD pipeline, Coolify deployment, 2 dev режима
- 6 NestJS микросервисов + 3 shared packages, Clean/Hexagonal архитектура
- PostgreSQL (Drizzle ORM), Redis, RabbitMQ, Garage S3 — вся инфра в Coolify
- CI: GitHub Actions (lint, typecheck, build, Docker Build & Push, Coolify deploy)
- Dev: `start:native` (infra Docker + сервисы на хосте) и `start:isolated` (всё в Docker)
- Prod: api.email-platform.pp.ua, Dev: api.dev.email-platform.pp.ua
- Garage WebUI: garage.email-platform.pp.ua (prod), garage.dev.email-platform.pp.ua (dev)
- Контроллеры — заглушки, бизнес-логика не реализована
- PersistenceModule — reference implementation для infrastructure module pattern
- Foundation даёт каркасы, каждый сервис автономно собирает нужные адаптеры

## Constraints

- **Архитектура apps/**: Clean/DDD/Hexagonal — проверяется через architecture-validator агент
- **Архитектура packages/**: Простая утилитарная структура, без DDD
- **Без бизнес-логики**: Только структурный каркас (ports, adapters, use cases) — реализация позже
- **Без тестов**: Тестирование — отдельный следующий этап
- **Tech stack**: NestJS 11, TypeScript, gRPC, PostgreSQL, Drizzle ORM, RabbitMQ, Redis

## Key Decisions

| Decision                                                             | Rationale                                                                                                                                                                                                                                                                                                                                                                                        | Outcome                 |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| DDD только в apps/, не в packages/                                   | Packages — утилитарные библиотеки, DDD в них избыточен                                                                                                                                                                                                                                                                                                                                           | ✓ Good                  |
| Тесты отложены на следующий этап                                     | Сначала прочный фундамент, потом покрытие тестами                                                                                                                                                                                                                                                                                                                                                | — Pending               |
| Бизнес-логику не реализуем                                           | Фокус на архитектурной чистоте, не на фичах                                                                                                                                                                                                                                                                                                                                                      | — Pending               |
| MongoDB → PostgreSQL + Drizzle                                       | Реляционные данные (кампании→группы→получатели), типобезопасность, миграции, лучший DDD fit                                                                                                                                                                                                                                                                                                      | ✓ Good                  |
| Kubernetes откладываем                                               | Docker Compose достаточен для текущего масштаба (6 сервисов)                                                                                                                                                                                                                                                                                                                                     | — Pending               |
| Инфра-изменения только с одобрения                                   | Порты, credentials, docker-compose нельзя менять без согласования                                                                                                                                                                                                                                                                                                                                | ✓ Good                  |
| PersistenceModule — единый фасад для PostgreSQL+Redis                | Один модуль, один pool, один scope. Нет отдельных DrizzleModule/HealthModule                                                                                                                                                                                                                                                                                                                     | ✓ Good                  |
| Deployment через Coolify                                             | Self-hosted PaaS для всех проектов, auto-deploy из GitHub, Traefik + auto-TLS                                                                                                                                                                                                                                                                                                                    | ✓ Good                  |
| CI push-based deploy вместо Diun                                     | Diun слал 6 webhooks per cycle, CI вызывает Coolify API 1 раз после сборки                                                                                                                                                                                                                                                                                                                       | ✓ Good                  |
| Garage вместо MinIO на prod                                          | Coolify one-click, S3-compatible, легковесный                                                                                                                                                                                                                                                                                                                                                    | ✓ Good                  |
| Build-info.json вместо env vars                                      | Зашито в образ при сборке, не зависит от runtime env                                                                                                                                                                                                                                                                                                                                             | ✓ Good                  |
| Canonical Config Access Contract (per-service `{SVC}_CONFIG` Symbol) | Единый pattern для config-инъекции — идентичность сервиса задаёт root Symbol; foundation объявляет narrow config interfaces (`CacheConfig`/`PersistenceConfig`/`GrpcClientConfig`/…); apps собирают slice-factories через `{SVC}_CONFIG`. Заменяет `@nestjs/config` полностью. `@Global()` per-service `{Svc}ConfigModule` — обязательно для резолва nested `forRootAsync`                       | ✓ Good — Phase 999.11.1 |
| Use-case config-purity (D-09)                                        | `application/use-cases/` получают env-values как method args, не через DI. Keeps use-cases чистыми и тестируемыми без config fixtures                                                                                                                                                                                                                                                            | ✓ Good — Phase 999.11.1 |
| Canonical infrastructure tree split (inbound/outbound/bootstrap)     | `apps/{svc}/src/infrastructure/` делится на 3 bin per Cockburn primary/secondary + Uncle Bob Ring 3/Ring 4. Inbound = driving adapters (controllers/consumers). Outbound = driven adapters (repositories/clients/publishers). Bootstrap = framework glue (config/health/throttle/logging) — не adapters, Ring 4. Feature-slicing внутри каждого направления по aggregate/upstream/vendor/concern | ✓ Good — Phase 999.11.2 |
| Inbound port bindings co-located with controller (D-02 refinement)   | port→service bindings (`{ provide: XXX_PORT, useClass: YyyService }`) живут в inbound adapter module (GrpcModule/RmqModule), не в root {Svc}Module. Hexagonal cohesion: inbound module владеет всем что его controller consumes. Surfaced by Phase 999.11.2 Plan 10 D-14 smoke gate (DI scope regression caught at runtime)                                                                      | ✓ Good — Phase 999.11.2 |

## Infrastructure Module Architecture

Backing services абстрагированы через модули-фасады в packages/foundation. Каждый модуль владеет connection, health indicator и exports для сервисов.

| Модуль                                                        | Backing services                                                                                                                                                                                                                                               | Статус                  |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| **PersistenceModule**                                         | PostgreSQL (pool, Drizzle ORM, health)                                                                                                                                                                                                                         | Ready — Phase 10        |
| **CacheModule**                                               | Redis (DI client, CachePort, namespaced keys, health)                                                                                                                                                                                                          | Ready — Phase 21        |
| **S3CoreModule + BucketStorageModule + ReportsStorageModule** | MinIO / Garage (non-global S3Client singleton via class-identity dedup, self-contained BucketStorageModule.forBucket factory, shared reports module in foundation, per-bucket health tokens, reachable only via `@email-platform/foundation/internal` subpath) | Ready — Phase 22 + 22.1 |
| **EventModule**                                               | RabbitMQ (connection, publisher, consumer, health)                                                                                                                                                                                                             | Planned — Phase 25      |
| **gRPC Client Promisified Proxy**                             | gRPC (foundation `Promisified<T>` mapped type + Proxy factory; consumers inject typed Promise-returning client directly; deadline metadata + per-call CallOpts; observability deferred to future phase)                                                        | Ready — Phase 999.7.3   |
| **HTTP Client + Circuit Breaker**                             | External HTTP APIs (resilient client, retry, timeout)                                                                                                                                                                                                          | Planned — Phase 24      |

Сервисы собирают только нужные модули:

- auth, sender, parser, audience → PersistenceModule
- sender → + EventModule (publish), + CacheModule (если Redis отдельно)
- notifier → EventModule (consume)
- gateway → нет backing service модулей (REST facade)

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):

1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):

1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

_Last updated: 2026-05-06 after Phase 999.19 complete (backing-services-canonical-cross-audit-5-layer — docs-only cross-cutting audit пяти backing-system слоёв cache/persistence/storage/clients/events против единого master invariant L0 + per-layer L1..L5. Output: 999.19-DESIGN.md (38 invariants I-N.N), 999.19-AUDIT.md (8 F-NN findings — 1 blocker F-02 PG_POOL Tier-2 leak, 1 major F-01 RedisCacheService.get<T> unchecked cast, 6 minor — L4 gRPC clients clean), 999.19-SOLUTIONS.md (1:1 variant catalog 7-col trade-off + sub-phase grouping placeholders 999.19.1..N + Backlog Impact на 999.13/999.14/22.5/999.3/999.4/999.5), 999.19-VERIFICATION.md (90 V-NN grep-proof rows — 80 ✅ / 10 ⚠️ catalogued / 0 ❌ uncatalogued, D-16 ≥30 порог превышен 200%), 999.19-SUMMARY.md (D-13 closure handoff), 999.19-VALIDATION.md flipped `nyquist_compliant: true`. Verifier goal-backward analysis 7/7 must-haves passed. D-14 phase independence соблюдено — 0 sub-phase ROADMAP rows / 0 phase.add SDK calls; sub-phases 999.19.1..N будут вставлены после user approval по SOLUTIONS.md per `/gsd:insert-phase`. Out-of-scope: 0 code changes (apps/* + packages/* unchanged). Previous closures между 999.17.3 и 999.19: 999.17.5 (drizzle-orm 1.x bump, esbuild closure), 999.18.4 (canonical 5-layer build architecture baseline) — см. git log --grep="phase-999".)_
