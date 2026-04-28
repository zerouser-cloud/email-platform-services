# Phase 24: HTTP Client & Circuit Breaker - Discussion Log

> **Audit trail only.** Locked decisions — в `24-CONTEXT.md`.

**Date:** 2026-04-15
**Phase:** 24-http-client-circuit-breaker
**Mode:** discuss (interactive)

## Architectural Discussion

### Главный вопрос: где живут per-API HTTP-адаптеры

Пользователь задал вопрос "что насчёт сторонних сервисов? будут ли контракты как proto-файлы?" — это привело к ключевому архитектурному решению: симметрия с gRPC после миграции 999.7.

**Аналогия с gRPC + 999.7:**
- gRPC: контракты в `packages/contracts/proto/`, foundation = только примитивы (`AbstractGrpcClient`), per-service адаптеры в `apps/{service}/infrastructure/clients/` (после миграции 999.7)
- HTTP: типы в `packages/contracts/src/external/{api}/`, foundation = только примитивы (`AbstractHttpClient`), per-service адаптеры в `apps/{service}/infrastructure/clients/` (**сразу**, не повторяем ошибку Phase 23)

Решение: типы внешних API в `contracts` (сейчас не шарятся, но если завтра второй consumer — типы уже на месте), foundation HTTP-агностичен к API.

### HTTP transport — native fetch/undici

Пользователь явно отказался от axios/got: "сторонние библиотеки не рассматриваем, они были до того как появилась полная поддержка fetch, щас в них смысла мало".

Решение: native `fetch` + `undici` из Node 20. Ноль HTTP-зависимостей.

## Gray Areas Presented

| # | Area | Choice | Recommended? |
|---|------|--------|--------------|
| 0 | Структура (где per-API адаптеры) | `apps/{service}/infrastructure/clients/` + типы в `contracts/src/external/` | ✅ pre-decided after architectural discussion |
| 1 | HTTP библиотека | native fetch/undici (Node 20) | ✅ matched after explanation |
| 2 | Circuit breaker библиотека | opossum | ✅ |
| 3 | Health (пробивать external?) | НЕ пробивать | ✅ (Google SRE pattern) |
| 4 | Defaults | 3 retries + exp backoff + jitter, 5с timeout, CB 5/30s + Logging interceptor + Idempotency-aware retry | ✅ all three checked |

## Notes

- **Circuit breaker explained** — пользователь попросил развернуть concept; объяснены три состояния (closed/open/half-open), сценарии работы, изоляция per-adapter.
- **fetch vs axios/got** — пользователь попросил рассказать про native; объяснено что fetch + undici в Node 20 без install, axios/got считаются устаревшими.
- **Idempotency-aware retry** — критично для POST/PATCH/DELETE: дефолтный retry **только** на GET/HEAD; для idempotent POST endpoints — явный opt-in флаг.
- **Body НЕ логируется** — PII, secrets, bot tokens; debug body redaction отложена.

## Deferred (захвачено в CONTEXT.md `<deferred>`)

- Полная бизнес-реализация Telegram/AppStoreSpy/CloudFn (только skeleton-методы в этой фазе)
- Метрики CB / latency в Prometheus → OTEL v5
- CB state в /health/ready → отклонено
- Cross-instance CB sync → out of scope
- Bulkhead pattern → отдельная история
- Sampled health probe → отклонено как избыточная сложность

## Format

Серые зоны представлены через AskUserQuestion. Структурная зона решена в архитектурном диалоге до опроса. CB concept развёрнуто отдельным объяснением по запросу. Native fetch/undici объяснено отдельным сообщением по запросу.
