# Requirements: Email Platform Foundation Audit

**Defined:** 2026-04-02
**Core Value:** Каждый сервис изолирован, с чёткими границами и надёжными контрактами

## v1 Requirements

### Contract Hygiene

- [x] **CONT-01**: Единственный источник сгенерированных типов — `contracts/src/generated/`, дубликат `contracts/generated/` удалён
- [x] **CONT-02**: Proto генерация встроена в Turbo pipeline и запускается автоматически при сборке
- [x] **CONT-03**: Команда `pnpm generate:contracts` доступна на верхнем уровне монорепо
- [x] **CONT-04**: Controller stubs в auth, sender, parser, audience содержат `@GrpcMethod` декораторы, соответствующие proto RPC методам (без бизнес-логики)

### Configuration Management

- [x] **CONF-01**: `loadGlobalConfig()` вызывается один раз, конфигурация доступна через injectable `ConfigService` во всех сервисах
- [x] **CONF-02**: Zod-схема конфигурации отклоняет `CORS_ORIGINS=*` при `NODE_ENV=production`
- [x] **CONF-03**: MinIO credentials в docker-compose используют env var substitution `${VAR:-default}` вместо хардкода

### Error Handling & Safety

- [x] **ERR-01**: Metadata array access в logging module использует optional chaining с fallback на `crypto.randomUUID()`
- [x] **ERR-02**: gRPC error messages маппятся на безопасные клиентские сообщения, оригиналы логируются server-side
- [x] **ERR-03**: Все сервисы возвращают ошибки в едином формате `{ statusCode, message, error, correlationId }` через global exception filter

### Architectural Boundaries

- [x] **ARCH-01**: Каждый app в apps/ имеет корректную Clean/Hexagonal структуру (domain/application/infrastructure) — валидация через architecture-validator агент
- [x] **ARCH-02**: Shared код живёт в packages/, service-specific в apps/. Нет cross-service импортов между apps/
- [x] **ARCH-03**: Notifier оформлен как event-consumer-only сервис с RabbitMQ health check (без gRPC)

### Health & Resilience

- [ ] **HLTH-01**: Gateway проверяет health gRPC сервисов параллельно через `Promise.all()`
- [x] **HLTH-02**: Retry configuration уменьшена до разумных значений и конфигурируема через env vars
- [x] **HLTH-03**: Раздельные liveness (процесс жив) и readiness (зависимости готовы) probe endpoints

### Logging & Observability

- [ ] **LOG-01**: Pino логи содержат structured fields: service name, environment, instanceId
- [ ] **LOG-02**: NestJS interceptor логирует request/response timing: `{ method, path, statusCode, durationMs }`

### Security

- [ ] **SEC-01**: CORS wildcard запрещён в production, `.env.example` содержит безопасные defaults с комментариями

### Operational

- [ ] **OPS-01**: Graceful shutdown: in-flight requests завершаются, gRPC connections drainятся, DB/RabbitMQ pools закрываются через `enableShutdownHooks()` и `onModuleDestroy`

### Verification

- [ ] **VER-01**: Инфраструктура (MongoDB, Redis, RabbitMQ, MinIO) поднята через docker compose (команда из package.json)
- [ ] **VER-02**: Все сервисы запускаются без ошибок через команду из package.json
- [ ] **VER-03**: Health endpoints всех сервисов отвечают корректно через curl
- [ ] **VER-04**: Gateway проксирует запросы к gRPC сервисам, ошибки возвращаются в едином формате

## v2 Requirements

### Observability

- **OBS-01**: OpenTelemetry distributed tracing с gRPC и HTTP auto-instrumentation
- **OBS-02**: OpenAPI/Swagger спецификация для gateway

### Resilience

- **RES-01**: Circuit breaker для inter-service gRPC вызовов
- **RES-02**: Connection pool configuration для MongoDB, Redis, RabbitMQ

### Security

- **SEC-02**: Pre-commit hook для детекции secrets

### Testing

- **TEST-01**: Unit-тесты для foundation modules (errors, retry, interceptors)
- **TEST-02**: Integration-тесты для startup и health checks сервисов

## Out of Scope

| Feature | Reason |
|---------|--------|
| Бизнес-логика в сервисах | Сначала фундамент, потом бизнес-логика |
| Тесты | Следующий этап после аудита |
| Новые сервисы | Работаем с существующими 6 сервисами |
| DDD в packages/ | Утилитарные библиотеки, DDD излишний |
| Миграция с Turbo на Nx | Turbo работает, менять нет причин |
| CI/CD pipeline | Инфраструктурная задача, не часть code audit |
| API versioning | Нет consumers, версионирование пустых stubs бесполезно |
| Database migrations | Нет бизнес-моделей, миграции преждевременны |
| Buf CLI | Текущий generate.sh скрипт работает, замена ради моды не нужна |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONT-01 | Phase 1 | Complete |
| CONT-02 | Phase 1 | Complete |
| CONT-03 | Phase 1 | Complete |
| CONT-04 | Phase 5 | Complete |
| CONF-01 | Phase 2 | Complete |
| CONF-02 | Phase 2 | Complete |
| CONF-03 | Phase 2 | Complete |
| ERR-01 | Phase 3 | Complete |
| ERR-02 | Phase 3 | Complete |
| ERR-03 | Phase 3 | Complete |
| ARCH-01 | Phase 4 | Complete |
| ARCH-02 | Phase 5 | Complete |
| ARCH-03 | Phase 5 | Complete |
| HLTH-01 | Phase 6 | Pending |
| HLTH-02 | Phase 6 | Complete |
| HLTH-03 | Phase 6 | Complete |
| LOG-01 | Phase 7 | Pending |
| LOG-02 | Phase 7 | Pending |
| SEC-01 | Phase 7 | Pending |
| OPS-01 | Phase 7 | Pending |
| VER-01 | Phase 8 | Pending |
| VER-02 | Phase 8 | Pending |
| VER-03 | Phase 8 | Pending |
| VER-04 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0

---
*Requirements defined: 2026-04-02*
*Last updated: 2026-04-02 after roadmap creation*
