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
- S3 client через AWS SDK (unified MinIO/Garage, env rename MINIO_* → S3_*)
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

### Active
- [ ] gRPC client каркас в foundation + per-service адаптеры
- [ ] RabbitMQ publisher/consumer абстракция + per-service конфигурация
- [ ] HTTP client каркас для внешних API + per-service адаптеры
- [ ] S3 client через AWS SDK (unified MinIO/Garage, env rename MINIO_* → S3_*)
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

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| DDD только в apps/, не в packages/ | Packages — утилитарные библиотеки, DDD в них избыточен | ✓ Good |
| Тесты отложены на следующий этап | Сначала прочный фундамент, потом покрытие тестами | — Pending |
| Бизнес-логику не реализуем | Фокус на архитектурной чистоте, не на фичах | — Pending |
| MongoDB → PostgreSQL + Drizzle | Реляционные данные (кампании→группы→получатели), типобезопасность, миграции, лучший DDD fit | ✓ Good |
| Kubernetes откладываем | Docker Compose достаточен для текущего масштаба (6 сервисов) | — Pending |
| Инфра-изменения только с одобрения | Порты, credentials, docker-compose нельзя менять без согласования | ✓ Good |
| PersistenceModule — единый фасад для PostgreSQL+Redis | Один модуль, один pool, один scope. Нет отдельных DrizzleModule/HealthModule | ✓ Good |
| Deployment через Coolify | Self-hosted PaaS для всех проектов, auto-deploy из GitHub, Traefik + auto-TLS | ✓ Good |
| CI push-based deploy вместо Diun | Diun слал 6 webhooks per cycle, CI вызывает Coolify API 1 раз после сборки | ✓ Good |
| Garage вместо MinIO на prod | Coolify one-click, S3-compatible, легковесный | ✓ Good |
| Build-info.json вместо env vars | Зашито в образ при сборке, не зависит от runtime env | ✓ Good |

## Infrastructure Module Architecture

Backing services абстрагированы через модули-фасады в packages/foundation. Каждый модуль владеет connection, health indicator и exports для сервисов.

| Модуль | Backing services | Статус |
|--------|-----------------|--------|
| **PersistenceModule** | PostgreSQL (pool, Drizzle ORM, health) + Redis (client, health) | PostgreSQL ready, Redis planned |
| **StorageModule** | MinIO / S3 (client, health) | Planned |
| **EventModule** | RabbitMQ (connection, publisher, consumer, health) | Planned |

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
*Last updated: 2026-04-08 after v4.0 milestone start*
