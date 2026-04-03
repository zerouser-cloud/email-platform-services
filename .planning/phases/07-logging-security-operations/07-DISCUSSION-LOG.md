# Phase 7: Logging, Security & Operations - Discussion Log

> **Audit trail only.**

**Date:** 2026-04-03
**Phase:** 07-logging-security-operations
**Areas discussed:** Logging fields, Graceful shutdown

---

## Logging fields (instanceId source)

| Option | Description | Selected |
|--------|-------------|----------|
| crypto.randomUUID() (Recommended) | Генерировать при старте процесса. Просто, уникально. | ✓ |
| hostname + PID | os.hostname():process.pid. Читаемее, но не уникально после рестарта. | |

---

## Graceful shutdown (approach)

| Option | Description | Selected |
|--------|-------------|----------|
| Каркас + лог (Recommended) | onModuleDestroy с логированием. Drain когда появятся подключения. | |
| Полный stub | onModuleDestroy со всеми close() вызовами (даже без реальных connection) | ✓ |

## Claude's Discretion

- Interceptor implementation details
- onApplicationShutdown vs onModuleDestroy
- Log format for timing

## Deferred Ideas

Нет
