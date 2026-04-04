# Requirements: Email Platform

**Defined:** 2026-04-04
**Core Value:** Each service isolated with clear boundaries, single source of truth, and correct contracts -- reliable foundation for business logic

## v2.0 Requirements

Requirements for PostgreSQL + Drizzle Migration. Each maps to roadmap phases.

### Infrastructure

- [x] **INFRA-01**: DATABASE_URL добавлен в env-schema с Zod-валидацией, MONGO_URI удалён
- [x] **INFRA-02**: PostgreSQL 16 в docker-compose заменяет MongoDB, volume для persistence
- [x] **INFRA-03**: Все упоминания MongoDB удалены из кодовой базы и конфигурации

### Foundation

- [x] **FOUND-01**: DrizzleModule в packages/foundation — NestJS dynamic module с DI injection token
- [x] **FOUND-02**: DatabaseHealthIndicator абстракция через DI token — конкретная реализация (PostgresHealthIndicator) регистрируется в module, controller не знает о типе базы
- [x] **FOUND-03**: Pool lifecycle — graceful shutdown через OnApplicationShutdown

### Schema

- [x] **SCHM-01**: Drizzle schema per service (auth, sender, parser, audience) с pgSchema isolation
- [x] **SCHM-02**: drizzle-kit config и migration workflow настроены для каждого сервиса
- [x] **SCHM-03**: Drizzle types не проникают в domain layer — маппинг только в infrastructure

### Repository

- [x] **REPO-01**: Auth repository adapter реализован с Drizzle (reference implementation)
- [ ] **REPO-02**: Sender, Parser, Audience repository adapters реализованы с Drizzle
- [ ] **REPO-03**: Repository adapters маппят Drizzle rows в domain entities без утечки типов

### Verification

- [ ] **VRFY-01**: Все 6 сервисов стартуют, health checks проходят, docker-compose up работает
- [ ] **VRFY-02**: Документация обновлена (CLAUDE.md, tech stack, README)

## v1.0 Requirements (Validated)

- [x] **ARCH-01**: Каждый app в apps/ имеет корректную Clean/Hexagonal структуру — Phase 4-5
- [x] **ARCH-02**: Нет cross-service imports между apps/ — Phase 5
- [x] **ARCH-03**: Notifier is event-consumer-only (no gRPC) — Phase 5
- [x] **CNTR-01**: Единый источник сгенерированных контрактов — Phase 1
- [x] **CNTR-02**: Proto генерация в Turbo pipeline — Phase 1
- [x] **CONF-01**: Config через DI, loadGlobalConfig только в main.ts — Phase 2
- [x] **CONF-02**: CORS wildcard запрещён в production — Phase 2
- [x] **ERR-01**: Error sanitization по gRPC code — Phase 3
- [x] **ERR-02**: Unified error shape с correlationId, timestamp — Phase 3
- [x] **HLTH-01**: Parallel gateway health via Promise.allSettled — Phase 6
- [x] **HLTH-02**: Liveness/readiness separation — Phase 6
- [x] **RSLN-01**: Retry tuned с jitter и env vars — Phase 6
- [x] **OPS-01**: Structured logging с correlation IDs — Phase 7
- [x] **OPS-02**: Graceful shutdown hooks — Phase 7

## Out of Scope

| Feature | Reason |
|---------|--------|
| Реализация бизнес-логики | Фокус на persistence infrastructure, бизнес-логика позже |
| Написание тестов | Тестирование — отдельный этап |
| neverthrow / Result pattern | Отдельный milestone после завершения документации |
| OpenTelemetry tracing | Отдельный milestone |
| Data migration | Нет живых данных — все repository стабы |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 9 | Complete |
| INFRA-02 | Phase 11 | Complete |
| INFRA-03 | Phase 9 | Complete |
| FOUND-01 | Phase 10 | Complete |
| FOUND-02 | Phase 10 | Complete |
| FOUND-03 | Phase 10 | Complete |
| SCHM-01 | Phase 12 | Complete |
| SCHM-02 | Phase 12 | Complete |
| SCHM-03 | Phase 12 | Complete |
| REPO-01 | Phase 12 | Complete |
| REPO-02 | Phase 13 | Pending |
| REPO-03 | Phase 13 | Pending |
| VRFY-01 | Phase 14 | Pending |
| VRFY-02 | Phase 14 | Pending |

**Coverage:**
- v2.0 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0

---
*Requirements defined: 2026-04-04*
*Last updated: 2026-04-04 after roadmap v2.0 creation*
