# Phase 5: Architecture Replication & Boundaries - Discussion Log

> **Audit trail only.**

**Date:** 2026-04-02
**Phase:** 05-architecture-replication-boundaries
**Areas discussed:** Scope на сервис, Notifier роль, Gateway

---

## Scope на сервис

| Option | Description | Selected |
|--------|-------------|----------|
| Да, минимальный | Слои + 1 entity, 1 port, 1 use-case, 1 adapter на сервис. Как auth. | ✓ |
| Полный по TARGET | Все entities, VOs, ports, use-cases из TARGET_ARCHITECTURE.md | |

---

## Notifier роль

| Option | Description | Selected |
|--------|-------------|----------|
| Слои без gRPC (Recommended) | domain/ + application/ + infrastructure/ но inbound = RabbitMQ subscriber. RabbitMQ health check. | ✓ |
| Без слоёв | Flat структура, простой consumer | |

---

## Gateway

| Option | Description | Selected |
|--------|-------------|----------|
| Нет, оставить flat | Controllers + guards + interceptors | |
| Да, минимальные | infrastructure/ для gRPC clients, без domain/ и application/ | ✓ |

## Claude's Discretion

- Exact file names, plan splitting, service processing order

## Deferred Ideas

Нет
