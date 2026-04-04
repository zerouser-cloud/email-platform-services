# Email Platform

## What This Is

Монорепозиторная email-платформа на базе NestJS микросервисов. 6 сервисов (gateway, auth, sender, parser, audience, notifier) и 3 shared-пакета (config, foundation, contracts). Clean/Hexagonal архитектура во всех сервисах с чёткими границами слоёв.

## Core Value

Каждый сервис должен быть изолированным, с чёткими границами, единым источником истины и правильными контрактами — чтобы бизнес-логика могла строиться на надёжном фундаменте без переделок.

## Current Milestone: v3.0 Infrastructure & CI/CD

**Goal:** Настроить правильные dev/docker/production флоу с CI/CD pipeline, соблюдая 12-Factor принципы.

**Target features:**
- Откат неавторизованных изменений порта (POSTGRES_PORT → стандартный 5432)
- Два режима разработки: local dev (infra в Docker, сервисы на хосте) и full Docker
- Разделение docker-compose (infra vs services)
- Синхронизация env файлов (.env, .env.docker, .env.example)
- CI/CD pipeline (build → test → push image → deploy)
- 12-Factor compliant deployment (один образ, разные env per environment)

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

### Active
- [ ] Изоляция сервисов — нет cross-service утечек, каждый сервис владеет своими данными
- [ ] Правильные контракты между сервисами (proto как единый источник истины)
- [ ] Устранение размазанности кода — общий код в packages/, специфичный в apps/
- [ ] Безопасность: CORS wildcard в production, unsanitized error messages, hardcoded credentials
- [ ] Корректная структура внутри каждого сервиса (ports, adapters, use cases) — без бизнес-логики, только каркас

### Out of Scope

- Реализация бизнес-логики в сервисах — сначала фундамент, потом бизнес-логика
- Написание тестов — запланировано на следующий этап
- Frontend — не в скоупе этого проекта
- Добавление новых сервисов — работаем с тем что есть
- DDD в packages/ — это утилитарные библиотеки, DDD там излишний

## Context

- Проект на раннем этапе: инфраструктура поднята, сервисы стартуют, но контроллеры пустые (заглушки)
- Архитектура заявлена как Clean/Hexagonal, но не везде реализована
- Proto-контракты определены, TypeScript типы сгенерированы, но дублируются в двух местах
- Foundation package содержит shared-модули (logging, errors, resilience, gRPC clients) — это правильно
- Конфигурация через Zod валидацию, но загружается множественно вместо одного раза
- Docker Compose для локальной разработки, Helm для deployment
- Есть встроенный агент `gsd-architecture-validator` для проверки Clean/DDD/Hexagonal в apps/

## Constraints

- **Архитектура apps/**: Clean/DDD/Hexagonal — проверяется через architecture-validator агент
- **Архитектура packages/**: Простая утилитарная структура, без DDD
- **Без бизнес-логики**: Только структурный каркас (ports, adapters, use cases) — реализация позже
- **Без тестов**: Тестирование — отдельный следующий этап
- **Tech stack**: NestJS 11, TypeScript, gRPC, PostgreSQL, Drizzle ORM, RabbitMQ, Redis

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| DDD только в apps/, не в packages/ | Packages — утилитарные библиотеки, DDD в них избыточен | ✓ Good |
| Тесты отложены на следующий этап | Сначала прочный фундамент, потом покрытие тестами | — Pending |
| Бизнес-логику не реализуем | Фокус на архитектурной чистоте, не на фичах | — Pending |
| MongoDB → PostgreSQL + Drizzle | Реляционные данные (кампании→группы→получатели), типобезопасность, миграции, лучший DDD fit | ✓ Good |
| Kubernetes откладываем | Docker Compose достаточен для текущего масштаба (6 сервисов) | — Pending |
| Инфра-изменения только с одобрения | Порты, credentials, docker-compose нельзя менять без согласования | ✓ Good |

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
*Last updated: 2026-04-04 after Phase 16 CI Pipeline complete*
