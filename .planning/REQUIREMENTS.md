# Requirements: Email Platform Foundation Audit

**Defined:** 2026-04-02
**Core Value:** Каждый сервис изолирован, с чёткими границами и надёжными контрактами

## v1 Requirements

### Contract Hygiene

- [ ] **CONT-01**: Единственный источник сгенерированных типов — `contracts/src/generated/`, дубликат `contracts/generated/` удалён
- [ ] **CONT-02**: Proto генерация встроена в Turbo pipeline и запускается автоматически при сборке
- [ ] **CONT-03**: Команда `pnpm generate:contracts` доступна на верхнем уровне монорепо
- [ ] **CONT-04**: Controller stubs в auth, sender, parser, audience содержат `@GrpcMethod` декораторы, соответствующие proto RPC методам (без бизнес-логики)

### Configuration Management

- [ ] **CONF-01**: `loadGlobalConfig()` вызывается один раз, конфигурация доступна через injectable `ConfigService` во всех сервисах
- [ ] **CONF-02**: Zod-схема конфигурации отклоняет `CORS_ORIGINS=*` при `NODE_ENV=production`
- [ ] **CONF-03**: MinIO credentials в docker-compose используют env var substitution `${VAR:-default}` вместо хардкода

### Error Handling & Safety

- [ ] **ERR-01**: Metadata array access в logging module использует optional chaining с fallback на `crypto.randomUUID()`
- [ ] **ERR-02**: gRPC error messages маппятся на безопасные клиентские сообщения, оригиналы логируются server-side
- [ ] **ERR-03**: Все сервисы возвращают ошибки в едином формате `{ statusCode, message, error, correlationId }` через global exception filter

### Architectural Boundaries

- [ ] **ARCH-01**: Каждый app в apps/ имеет корректную Clean/Hexagonal структуру (domain/application/infrastructure) — валидация через architecture-validator агент
- [ ] **ARCH-02**: Shared код живёт в packages/, service-specific в apps/. Нет cross-service импортов между apps/
- [ ] **ARCH-03**: Notifier оформлен как event-consumer-only сервис с RabbitMQ health check (без gRPC)

### Health & Resilience

- [ ] **HLTH-01**: Gateway проверяет health gRPC сервисов параллельно через `Promise.all()`
- [ ] **HLTH-02**: Retry configuration уменьшена до разумных значений и конфигурируема через env vars
- [ ] **HLTH-03**: Раздельные liveness (процесс жив) и readiness (зависимости готовы) probe endpoints

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
| CONT-01 | Pending | Pending |
| CONT-02 | Pending | Pending |
| CONT-03 | Pending | Pending |
| CONT-04 | Pending | Pending |
| CONF-01 | Pending | Pending |
| CONF-02 | Pending | Pending |
| CONF-03 | Pending | Pending |
| ERR-01 | Pending | Pending |
| ERR-02 | Pending | Pending |
| ERR-03 | Pending | Pending |
| ARCH-01 | Pending | Pending |
| ARCH-02 | Pending | Pending |
| ARCH-03 | Pending | Pending |
| HLTH-01 | Pending | Pending |
| HLTH-02 | Pending | Pending |
| HLTH-03 | Pending | Pending |
| LOG-01 | Pending | Pending |
| LOG-02 | Pending | Pending |
| SEC-01 | Pending | Pending |
| OPS-01 | Pending | Pending |
| VER-01 | Pending | Pending |
| VER-02 | Pending | Pending |
| VER-03 | Pending | Pending |
| VER-04 | Pending | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 0
- Unmapped: 24 ⚠️

---
*Requirements defined: 2026-04-02*
*Last updated: 2026-04-02 after initial definition*
