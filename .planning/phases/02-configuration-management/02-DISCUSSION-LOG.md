# Phase 2: Configuration Management - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 02-configuration-management
**Areas discussed:** Config DI подход, CORS validation

---

## Config DI подход

| Option | Description | Selected |
|--------|-------------|----------|
| Через ConfigService | NestJS ConfigService везде. Убрать все прямые loadGlobalConfig() из модулей. Оставить только в main.ts для bootstrap. | ✓ |
| Минимальный фикс | Оставить loadGlobalConfig() как есть (он кэширует). Просто добавить NODE_ENV validation. Меньше риска, но DI не улучшится. | |

**User's choice:** Полный DI рефакторинг через ConfigService
**Notes:** Нет

---

## CORS validation

| Option | Description | Selected |
|--------|-------------|----------|
| Zod refine (Recommended) | Добавить NODE_ENV в схему + .refine() проверку. Ошибка при запуске сервиса если production + wildcard. | ✓ |
| Runtime guard | Проверка в main.ts после загрузки конфига. Проще, но не в схеме валидации. | |

**User's choice:** Zod refine — валидация на уровне схемы
**Notes:** Нет

---

## Claude's Discretion

- Exact ConfigService getter patterns
- GrpcClientModule refactor approach
- Additional env-aware validations beyond CORS
- .env.example comment formatting

## Deferred Ideas

Нет
