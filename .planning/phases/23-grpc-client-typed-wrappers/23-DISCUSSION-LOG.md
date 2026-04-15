# Phase 23: gRPC Client Typed Wrappers - Discussion Log

> **Audit trail only.** Не используется агентами для планирования/исполнения.
> Locked decisions — в `23-CONTEXT.md`.

**Date:** 2026-04-15
**Phase:** 23-grpc-client-typed-wrappers
**Mode:** discuss (interactive)

## Gray Areas Presented

| # | Area | Recommended | User Choice |
|---|------|-------------|-------------|
| 1 | Consumer API style | Typed facade (Promise) | ✅ Typed facade (Promise) |
| 2 | Регистрация клиентов | Декларативный массив forRoot | **Per-service module-классы** (deviation) |
| 3 | DI токены | Symbol.for() в каталоге | ✅ Symbol.for() в каталоге (после развёрнутого объяснения) |
| 4 | Доп. функционал | Health + Per-call deadline | ✅ Health + Per-call deadline + **Client-side logging interceptor** |

## Notes

- **API стиль:** Принят Promise-API, RxJS не утекает в use-case слой consumer.
- **Регистрация:** Пользователь предпочёл per-service module-классы рекомендации с массивом — больше файлов, но явные границы и самодостаточные модули (соответствует паттерну `BucketStorageModule.forBucket()`).
- **DI токены:** Пользователь запросил развёрнутое объяснение текущего состояния и предложения. После пояснения про коллизии строк, нарушение CLAUDE.md, прецедент в smoke-контроллере и про необходимость `Symbol.for()` (а не `Symbol()`) — выбрана миграция каталога. Smoke мигрирует вместе.
- **Health/Deadline/Logging:** Multi-select, выбраны все три. Logging пока локальный (correlationId из CLS), реальная propagation — Phase 27.

## Deferred (захвачено в CONTEXT.md `<deferred>`)

- Correlation ID в metadata → Phase 27
- Client-side retry → отдельный todo
- Metrics/OTEL → v5.0
- Circuit breaker на gRPC → запрещено REQUIREMENTS.md
- Streaming RPC → когда появятся streams в proto

## Format

Серые зоны представлены через AskUserQuestion (4 questions), один ре-раунд по DI-токенам с расширенным объяснением до выбора.
