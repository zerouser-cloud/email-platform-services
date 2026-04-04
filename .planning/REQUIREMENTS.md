# Requirements: Email Platform

**Defined:** 2026-04-04
**Core Value:** Each service isolated with clear boundaries, single source of truth, and correct contracts -- reliable foundation for business logic

## v3.0 Requirements

Requirements for Infrastructure & CI/CD. Each maps to roadmap phases.

### Docker Compose & Environment

- [ ] **DOCK-01**: Docker Compose разделён на infra и services через `include` или profiles
- [ ] **DOCK-02**: Инфраструктурные порты экспонированы для local dev (5432, 6379, 5672, 9000)
- [ ] **DOCK-03**: POSTGRES_PORT переменная откатана — стандартный 5432 в docker-compose
- [ ] **DOCK-04**: Env файлы синхронизированы (.env, .env.docker, .env.example) — одинаковый набор ключей

### CI Pipeline

- [ ] **CI-01**: GitHub Actions workflow: lint + typecheck + build на каждый PR
- [ ] **CI-02**: Turbo affected-only выполнение — CI запускает только изменённые пакеты
- [ ] **CI-03**: Turbo remote cache через GitHub Actions cache

### Docker Build

- [ ] **DBLD-01**: Docker image build per service через matrix strategy в GitHub Actions
- [ ] **DBLD-02**: Образы публикуются в GHCR (GitHub Container Registry)
- [ ] **DBLD-03**: Scoped Docker layer cache per service

### Deployment

- [ ] **DPLY-01**: Deploy workflow: SSH на VPS, docker compose pull + up
- [ ] **DPLY-02**: Caddy как reverse proxy с auto-TLS
- [ ] **DPLY-03**: Health check verification после deploy

### Verification

- [ ] **VRFY-01**: Оба dev режима работают: local dev (infra в Docker) + full Docker
- [ ] **VRFY-02**: CI pipeline проходит на clean repo

## v2.0 Requirements (Validated)

- [x] **INFRA-01**: DATABASE_URL в env-schema с Zod-валидацией — Phase 9
- [x] **INFRA-02**: PostgreSQL 16 в docker-compose — Phase 11
- [x] **INFRA-03**: Все MongoDB упоминания удалены — Phase 9
- [x] **FOUND-01**: DrizzleModule в packages/foundation — Phase 10
- [x] **FOUND-02**: DatabaseHealthIndicator DI абстракция — Phase 10
- [x] **FOUND-03**: Pool lifecycle graceful shutdown — Phase 10
- [x] **SCHM-01**: pgSchema per service — Phase 12
- [x] **SCHM-02**: drizzle-kit config и migrations — Phase 12
- [x] **SCHM-03**: Drizzle types не в domain layer — Phase 12
- [x] **REPO-01**: Auth repository adapter — Phase 12
- [x] **REPO-02**: Sender, Parser, Audience adapters — Phase 13
- [x] **REPO-03**: Mappers keep types in infrastructure — Phase 13
- [x] **VRFY-01**: Все сервисы стартуют, health checks — Phase 14
- [x] **VRFY-02**: Документация обновлена — Phase 14

## v1.0 Requirements (Validated)

- [x] **ARCH-01**: Clean/Hexagonal структура — Phase 4-5
- [x] **ARCH-02**: Нет cross-service imports — Phase 5
- [x] **CNTR-01**: Единый источник контрактов — Phase 1
- [x] **CONF-01**: Config через DI — Phase 2
- [x] **ERR-01**: Error sanitization — Phase 3
- [x] **HLTH-01**: Parallel health checks — Phase 6
- [x] **OPS-01**: Structured logging — Phase 7

## Out of Scope

| Feature | Reason |
|---------|--------|
| Kubernetes | Docker Compose достаточен для текущего масштаба |
| Реализация бизнес-логики | Фокус на infrastructure/CI/CD |
| Тестирование (unit/integration) | Отдельный milestone |
| neverthrow / Result pattern | Отдельный milestone |
| SSL certs management (beyond Caddy auto) | Caddy handles auto-TLS |
| Multi-region deployment | Single VPS for now |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DOCK-01 | — | Pending |
| DOCK-02 | — | Pending |
| DOCK-03 | — | Pending |
| DOCK-04 | — | Pending |
| CI-01 | — | Pending |
| CI-02 | — | Pending |
| CI-03 | — | Pending |
| DBLD-01 | — | Pending |
| DBLD-02 | — | Pending |
| DBLD-03 | — | Pending |
| DPLY-01 | — | Pending |
| DPLY-02 | — | Pending |
| DPLY-03 | — | Pending |
| VRFY-01 | — | Pending |
| VRFY-02 | — | Pending |

**Coverage:**
- v3.0 requirements: 15 total
- Mapped to phases: 0
- Unmapped: 15

---
*Requirements defined: 2026-04-04*
*Last updated: 2026-04-04 after milestone v3.0 definition*
