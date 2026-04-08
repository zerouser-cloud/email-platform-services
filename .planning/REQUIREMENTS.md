# Requirements: Email Platform

**Defined:** 2026-04-08
**Core Value:** Каждый сервис должен быть изолированным, с чёткими границами, единым источником истины и правильными контрактами — чтобы бизнес-логика могла строиться на надёжном фундаменте без переделок.

## v4.0 Requirements

Requirements for Infrastructure Abstractions & Cross-Cutting milestone.

### Config Decomposition

- [x] **CFG-01**: Env schema разбита на модульные Zod sub-schemas per concern (redis, s3, rabbitmq, http, tracing)
- [x] **CFG-02**: Sub-schemas compose в GlobalEnvSchema через spread
- [x] **CFG-03**: Каждый сервис валидирует только свои env vars, не все
- [x] **CFG-04**: Добавление нового env var не требует изменения монолитной схемы

### Redis (CacheModule)

- [ ] **CACHE-01**: CacheModule в foundation с `forRootAsync()`, Symbol DI tokens, health indicator, shutdown service
- [ ] **CACHE-02**: Сервис может инжектить Redis client через DI token и выполнять get/set/del операции
- [ ] **CACHE-03**: Health indicator отражает реальное состояние Redis connection (замена stub)
- [ ] **CACHE-04**: Per-service namespace isolation (ключи не пересекаются между сервисами)

### S3 (StorageModule)

- [ ] **S3-01**: StorageModule в foundation с `forRootAsync()`, Symbol DI tokens, health indicator, shutdown service
- [ ] **S3-02**: Unified client через AWS SDK v3 работает с MinIO (local) и Garage (prod) без изменения кода
- [ ] **S3-03**: Env vars переименованы MINIO_* → S3_* (S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET)
- [ ] **S3-04**: Сервис может загружать, скачивать и удалять файлы через DI token

### gRPC Client

- [ ] **GRPC-01**: Type-safe gRPC client каркас в foundation с автоматической привязкой к proto контрактам
- [ ] **GRPC-02**: Каждый сервис конфигурирует только контракты тех сервисов, которые ему нужны
- [ ] **GRPC-03**: Gateway создаёт gRPC client для всех backend-сервисов через единый паттерн
- [ ] **GRPC-04**: Deadline/timeout propagation встроен в каркас

### HTTP Client

- [ ] **HTTP-01**: HTTP client каркас в foundation с retry, timeout, logging
- [ ] **HTTP-02**: Circuit breaker встроен в HTTP абстракцию для внешних вызовов
- [ ] **HTTP-03**: Per-service адаптеры для внешних API создаются на основе каркаса (AppStoreSpy, Telegram, Cloud Functions)
- [ ] **HTTP-04**: Circuit breaker применяется только к внешним HTTP вызовам, не к внутренним gRPC

### RabbitMQ (EventModule)

- [ ] **EVENT-01**: EventModule в foundation с publisher/consumer абстракцией, Symbol DI tokens, health indicator, shutdown service
- [ ] **EVENT-02**: Manual acknowledgment по умолчанию (не auto-ack)
- [ ] **EVENT-03**: Dead Letter Queue (DLQ) конфигурация из коробки
- [ ] **EVENT-04**: Per-service конфигурация publishers и consumers через декларативный подход
- [ ] **EVENT-05**: Сервис может публиковать события и подписываться на них через typed интерфейсы

### Graceful Shutdown

- [ ] **SHUT-01**: Централизованный ShutdownOrchestrator управляет порядком завершения всех модулей
- [ ] **SHUT-02**: In-flight запросы завершаются корректно перед закрытием connections
- [ ] **SHUT-03**: Порядок shutdown: прекращение приёма → drain in-flight → close connections (RabbitMQ → Redis → PostgreSQL)

### Distributed Tracing

- [ ] **TRACE-01**: Correlation ID propagation через gRPC metadata между сервисами
- [ ] **TRACE-02**: Correlation ID propagation через RabbitMQ message headers
- [ ] **TRACE-03**: Единый correlation ID прослеживается от gateway через все downstream сервисы и обратно

## v5.0 Requirements

Deferred to future release.

### Full OpenTelemetry

- **OTEL-01**: Полная интеграция OpenTelemetry с collector и Jaeger/Tempo
- **OTEL-02**: Auto-instrumentation для NestJS, HTTP, gRPC, amqplib
- **OTEL-03**: Metrics export (Prometheus-compatible)

### Advanced Patterns

- **ADV-01**: Saga/compensation pattern для distributed transactions
- **ADV-02**: Outbox pattern для guaranteed message delivery
- **ADV-03**: Redis pub/sub для real-time notifications

## v3.0 Requirements (Validated)

- [x] **DOCK-01**: Docker Compose split into infra and services — Phase 15
- [x] **DOCK-02**: Infrastructure ports exposed for local dev — Phase 15
- [x] **DOCK-03**: POSTGRES_PORT variable reverted — Phase 15
- [x] **DOCK-04**: Env files synchronized — Phase 15
- [x] **CI-01**: GitHub Actions workflow: lint + typecheck + build on every PR — Phase 16
- [x] **CI-02**: Turbo affected-only execution — Phase 16
- [x] **CI-03**: Turbo remote cache via GitHub Actions cache — Phase 16
- [x] **DBLD-01**: Docker image build per service via matrix — Phase 17
- [x] **DBLD-02**: Images published to GHCR — Phase 17
- [x] **DBLD-03**: Scoped Docker layer cache per service — Phase 17
- [x] **DPLY-01**: Coolify environments (dev + prod) — Phase 18
- [x] **DPLY-02**: Traefik routes with auto-TLS — Phase 18
- [x] **DPLY-03**: Health check verification after deploy — Phase 18
- [x] **VRFY-01**: Both dev modes work — Phase 19
- [x] **VRFY-02**: CI pipeline passes on clean repo — Phase 19

## v2.0 Requirements (Validated)

- [x] **INFRA-01**: DATABASE_URL in env-schema with Zod validation — Phase 9
- [x] **INFRA-02**: PostgreSQL 16 in docker-compose — Phase 11
- [x] **INFRA-03**: All MongoDB references removed — Phase 9
- [x] **FOUND-01**: DrizzleModule in packages/foundation — Phase 10
- [x] **FOUND-02**: DatabaseHealthIndicator DI abstraction — Phase 10
- [x] **FOUND-03**: Pool lifecycle graceful shutdown — Phase 10
- [x] **SCHM-01**: pgSchema per service — Phase 12
- [x] **SCHM-02**: drizzle-kit config and migrations — Phase 12
- [x] **SCHM-03**: Drizzle types not in domain layer — Phase 12
- [x] **REPO-01**: Auth repository adapter — Phase 12
- [x] **REPO-02**: Sender, Parser, Audience adapters — Phase 13
- [x] **REPO-03**: Mappers keep types in infrastructure — Phase 13
- [x] **VRFY-01**: All services start, health checks — Phase 14
- [x] **VRFY-02**: Documentation updated — Phase 14

## v1.0 Requirements (Validated)

- [x] **ARCH-01**: Clean/Hexagonal structure — Phase 4-5
- [x] **ARCH-02**: No cross-service imports — Phase 5
- [x] **CNTR-01**: Single source of contracts — Phase 1
- [x] **CONF-01**: Config via DI — Phase 2
- [x] **ERR-01**: Error sanitization — Phase 3
- [x] **HLTH-01**: Parallel health checks — Phase 6
- [x] **OPS-01**: Structured logging — Phase 7

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full OpenTelemetry с collector | Overhead для текущего масштаба (1 сервер), lightweight tracing достаточно |
| Saga pattern | Нет distributed transactions в текущих use cases |
| Redis pub/sub | Нет real-time requirements пока |
| Kubernetes service mesh | Docker Compose достаточен для текущего масштаба |
| Custom message broker | RabbitMQ через @golevelup покрывает все потребности |
| Business logic implementation | Focus on infrastructure abstractions |
| Testing (unit/integration) | Separate milestone |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CFG-01 | Phase 20 | Complete |
| CFG-02 | Phase 20 | Complete |
| CFG-03 | Phase 20 | Complete |
| CFG-04 | Phase 20 | Complete |
| CACHE-01 | Phase 21 | Pending |
| CACHE-02 | Phase 21 | Pending |
| CACHE-03 | Phase 21 | Pending |
| CACHE-04 | Phase 21 | Pending |
| S3-01 | Phase 22 | Pending |
| S3-02 | Phase 22 | Pending |
| S3-03 | Phase 22 | Pending |
| S3-04 | Phase 22 | Pending |
| GRPC-01 | Phase 23 | Pending |
| GRPC-02 | Phase 23 | Pending |
| GRPC-03 | Phase 23 | Pending |
| GRPC-04 | Phase 23 | Pending |
| HTTP-01 | Phase 24 | Pending |
| HTTP-02 | Phase 24 | Pending |
| HTTP-03 | Phase 24 | Pending |
| HTTP-04 | Phase 24 | Pending |
| EVENT-01 | Phase 25 | Pending |
| EVENT-02 | Phase 25 | Pending |
| EVENT-03 | Phase 25 | Pending |
| EVENT-04 | Phase 25 | Pending |
| EVENT-05 | Phase 25 | Pending |
| SHUT-01 | Phase 26 | Pending |
| SHUT-02 | Phase 26 | Pending |
| SHUT-03 | Phase 26 | Pending |
| TRACE-01 | Phase 27 | Pending |
| TRACE-02 | Phase 27 | Pending |
| TRACE-03 | Phase 27 | Pending |

**Coverage:**
- v4.0 requirements: 31 total
- Mapped to phases: 31
- Unmapped: 0

---
*Requirements defined: 2026-04-08*
*Last updated: 2026-04-08 after roadmap creation*
