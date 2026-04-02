# Phase 6: Health & Resilience - Discussion Log

> **Audit trail only.**

**Date:** 2026-04-02
**Phase:** 06-health-resilience
**Areas discussed:** Retry настройки, Liveness/readiness

---

## Retry defaults

| Option | Description | Selected |
|--------|-------------|----------|
| 5 / 200ms / 5s (Recommended) | 5 попыток, 200ms base, 5s max. ~10сек суммарно. | ✓ |
| 3 / 500ms / 3s | 3 попытки, быстрее. | |

---

## Liveness/readiness scope

| Option | Description | Selected |
|--------|-------------|----------|
| Все сервисы (Recommended) | Каждый сервис проверяет свои зависимости в readiness | ✓ |
| Только gateway | Gateway проверяет gRPC, остальные как есть | |

**Notes:** Liveness упрощается до always-200 (без heap check). Readiness — полная проверка зависимостей каждого сервиса.

## Claude's Discretion

- MongoDB indicator type (Mongoose vs custom ping)
- File organization в health/ директориях

## Deferred Ideas

Нет
