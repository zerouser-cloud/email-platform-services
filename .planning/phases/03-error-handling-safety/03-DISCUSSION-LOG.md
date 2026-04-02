# Phase 3: Error Handling & Safety - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-04-02
**Phase:** 03-error-handling-safety
**Areas discussed:** Error shape, Sanitization

---

## Error shape (correlationId source)

| Option | Description | Selected |
|--------|-------------|----------|
| CLS context (Recommended) | ClsService.getId() — уже генерируется для каждого запроса. Гарантированно есть. | ✓ |
| Request header | X-Correlation-ID header. Пробрасывается от клиента, может отсутствовать. | |

**User's choice:** CLS context
**Notes:** Нет

---

## Sanitization strategy

| Option | Description | Selected |
|--------|-------------|----------|
| По gRPC коду (Recommended) | Каждый gRPC status code → safe message из ERROR_MESSAGE. Оригинал только в логи. | ✓ |
| Whitelist сообщений | Если message в whitelist — пробрасываем. Иначе safe fallback. Гибче, но сложнее. | |

**User's choice:** По gRPC коду
**Notes:** Нет

## Claude's Discretion

- Добавление timestamp в error responses
- Точные формулировки новых ERROR_MESSAGE
- Изменения в AllRpcExceptionsFilter

## Deferred Ideas

Нет
