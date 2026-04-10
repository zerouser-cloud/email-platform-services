# Phase 20: Config Decomposition - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-08
**Phase:** 20-config-decomposition
**Areas discussed:** Гранулярность sub-schemas, Per-service валидация, API для сервисов, Env var naming

---

## Гранулярность sub-schemas

| Option | Description | Selected |
|--------|-------------|----------|
| Per-concern | Один файл = один backing service / cross-cutting concern (database.ts, redis.ts, etc.) | ✓ |
| Per-module group | Группы по модулям foundation (PersistenceSchema = DB + Redis) | |
| Keep infra + extend | Оставить InfrastructureSchema, добавить отдельные для cross-cutting | |

**User's choice:** Per-concern — рекомендация Claude, user согласился
**Notes:** Per-module group отвергнут потому что группировка DATABASE_URL + REDIS_URL заставила бы auth валидировать REDIS_URL без необходимости

---

## Per-service валидация

| Option | Description | Selected |
|--------|-------------|----------|
| Явный compose в infrastructure layer | apps/*/src/infrastructure/config/ — аналогия с gRPC clients в hexagonal | ✓ |
| Явный compose в main.ts | loadConfig(TopologySchema, DatabaseSchema, ...) прямо в main.ts | |
| Module-driven | Автоматический вывод схемы из импортов NestJS модулей | |
| Service manifest | Отдельный service-config.ts в каждом сервисе | |

**User's choice:** Infrastructure layer — user предложил по аналогии с gRPC client hexagonal pattern
**Notes:** User явно указал: без автоматики, всё ручное и предсказуемое, но с абстракцией (не в main.ts). Проверена совместимость с hexagonal — противоречий нет: infrastructure знает backing services, application/domain получают values через DI.

---

## API для сервисов

**User's choice:** AppConfigModule.forRoot(schema) + composeSchemas() утилита
**Notes:** Быстро согласовано, вытекает из предыдущих решений

---

## Env var naming

| Option | Description | Selected |
|--------|-------------|----------|
| Сохранить существующие | STORAGE_*, REDIS_URL, RABBITMQ_URL, DATABASE_URL | ✓ |
| Переименовать в S3_* | STORAGE_* → S3_* | |

**User's choice:** Сохранить — в коде уже STORAGE_*, переименование не нужно
**Notes:** MINIO_ROOT_USER/PASSWORD — внутренние переменные MinIO контейнера для docker-compose, не часть приложения. На Coolify (Garage) их нет. Новые concerns: TRACING_*, CIRCUIT_BREAKER_*.

---

## Claude's Discretion

- Реализация composeSchemas()
- Структура type exports
- Порядок миграции сервисов

## Deferred Ideas

None
