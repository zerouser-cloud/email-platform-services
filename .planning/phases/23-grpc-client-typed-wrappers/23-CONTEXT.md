# Phase 23: gRPC Client Typed Wrappers - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Type-safe gRPC client framework в `packages/foundation/` + per-service модули клиентов, используемые consumer-сервисами (gateway, sender, audience, ...). Каждый сервис регистрирует только тех клиентов, кого реально вызывает; вызовы типизированы из proto, deadline propagation встроен, health upstream-ов виден в readiness.

Out of scope: server-side gRPC (уже в foundation), correlation ID propagation через metadata (Phase 27), retry policy на client-side (отложено).

</domain>

<decisions>
## Implementation Decisions

### Consumer API style
- **D-01:** Typed facade с Promise-API. Consumer делает `inject(AudienceClient)` и вызывает `await audience.listRecipients(req)`. Observable→Promise конверсия скрыта внутри foundation. Compile-error на несуществующем методе или несовпадении типов из proto-сгенерированных интерфейсов.
- **D-02:** RxJS не утекает в application/use-case слой consumer-сервисов.

### Регистрация клиентов
- **D-03:** Per-service module-классы в foundation: `AudienceClientModule`, `AuthClientModule`, `ParserClientModule`, `SenderClientModule`, `NotifierClientModule`. Каждый модуль самодостаточен (factory, deadline interceptor, health indicator).
- **D-04:** Consumer импортирует только нужные модули в `imports: [...]` своего AppModule. Sender → `[AudienceClientModule, ParserClientModule]` и т.п.
- **D-05:** Gateway импортирует все 5 модулей (соответствует success criterion #3 — "Gateway creates typed clients for all five backend services through the same registration pattern").

### DI токены
- **D-06:** `diToken: symbol` в `SERVICE` каталоге (`packages/config/src/catalog/`). Создаются через `Symbol.for(`${UPPER_ID}_GRPC_CLIENT`)` чтобы сохранять идентичность между разными импортами.
- **D-07:** Тип `GrpcServiceDeclaration.diToken` меняется со `string` на `symbol`.
- **D-08:** Существующая локальная строковая константа `PARSER_SMOKE_CLIENT`/`NOTIFIER_SMOKE_CLIENT` в `apps/gateway/src/test/storage-smoke.controller.ts` мигрирует на `SERVICE.parser.diToken` / `SERVICE.notifier.diToken`. Исключений из правила symbol-токенов нет.

### Health
- **D-09:** Каждый per-service client module регистрирует свой `GrpcClientHealthIndicator`, использующий стандартный gRPC Health Checking Protocol (`grpc.health.v1.Health/Check`). Зависимость `grpc-health-check` уже в проекте.
- **D-10:** Health indicator подключается в readiness-эндпоинт consumer-сервиса (gateway видит статус всех 5 upstream-ов, sender — audience+parser, и т.д.).

### Deadline
- **D-11:** Сохраняется глобальный channel-level deadline через interceptor (текущее поведение `createDeadlineInterceptor(GRPC_DEADLINE_MS)`).
- **D-12:** Добавляется опциональный per-call override: `audience.method(req, { deadlineMs })`. Если не передан — берётся `GRPC_DEADLINE_MS` из env. Реализуется через gRPC metadata `grpc-timeout` или per-call `Deadline` опцию channel-а.

### Logging
- **D-13:** Client-side logging interceptor: per-call лог (`grpc.client.call`) с полями service, method, duration_ms, status, correlationId. Pino через DI (как в server-side gRPC logging).
- **D-14:** Correlation ID берётся из CLS (уже подключён глобально через nestjs-cls). Реальная propagation в metadata — отдельная фаза 27, сейчас только локальное логирование.

### Claude's Discretion
- Точная структура файлов внутри каждого `*ClientModule` (один файл vs split на factory/health/interceptor)
- Имя класса typed facade (`AudienceClient` vs `AudienceGrpcClient`)
- Реализация Observable→Promise: `lastValueFrom` per call vs Proxy один раз на client
- Формат лога (структура полей)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 23 inputs
- `.planning/REQUIREMENTS.md` § "gRPC Client" — GRPC-01..04
- `.planning/ROADMAP.md` § "Phase 23: gRPC Client Typed Wrappers" — goal + 4 success criteria

### Существующий код, который меняется/расширяется
- `packages/foundation/src/external/grpc/grpc-client.module.ts` — текущий `GrpcClientModule.register()`, заменяется/дополняется per-service модулями
- `packages/foundation/src/external/grpc/proto-resolver.ts` — резолвинг proto-путей, переиспользуется
- `packages/foundation/src/external/resilience/grpc-deadline.interceptor.ts` — `createDeadlineInterceptor`, переиспользуется + расширяется per-call override
- `packages/config/src/catalog/define-service.ts` — `diToken` мигрирует на `Symbol.for()`
- `packages/config/src/catalog/types.ts` — `GrpcServiceDeclaration.diToken: symbol`
- `packages/config/src/topology.ts` — env keys для GRPC_URL, без изменений
- `packages/config/src/schemas/grpc.ts` — `GRPC_DEADLINE_MS`, без изменений
- `apps/gateway/src/infrastructure/clients/grpc-clients.module.ts` — пустой TODO-стаб, заполняется
- `apps/gateway/src/test/storage-smoke.controller.ts` — мигрирует с локальных строковых токенов на `SERVICE.x.diToken`

### Архитектурные ориентиры (паттерны, которым следовать)
- `packages/foundation/src/external/cache/` — CacheModule pattern (Symbol DI tokens, health indicator, shutdown) — Phase 21
- `packages/foundation/src/external/storage/` — StorageModule pattern (per-bucket модули, health) — Phase 22
- `packages/foundation/src/external/persistence/` — PersistenceModule (DI токены, health indicator)

### Project rules
- `CLAUDE.md` § "Code Style" — DI токены через `Symbol()`, no magic values
- `CLAUDE.md` § "Architecture Constraints" — apps/ Clean/Hexagonal, packages/ утилитарная

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `GrpcClientModule.register()` — текущая обёртка над `ClientsModule.registerAsync` с deadline-интерцептором; будет переиспользована/реструктурирована внутри per-service модулей
- `createDeadlineInterceptor(deadlineMs)` — channel-level deadline через grpc-js interceptor; расширится поддержкой per-call override
- `resolveProtoPath(package, protoDir)` — резолвинг proto-файлов из конфигурируемой PROTO_DIR; переиспользуется без изменений
- `SERVICE` каталог в `@email-platform/config` — единый источник истины для service id/port/grpc package/diToken/envKeys
- `nestjs-cls` глобально подключён — источник correlationId для client-side logging
- `grpc-health-check` 2.1.0 в зависимостях — server side; для client используется генерируемый из `grpc.health.v1.Health` сервиса

### Established Patterns
- **Foundation external/internal partition** (Phase 22.1): публичный API через `@email-platform/foundation`, внутренние детали через `@email-platform/foundation/internal`. Per-service client модули — публичные (external/grpc/clients/).
- **Module factory с health indicator** (CacheModule, StorageModule, PersistenceModule): `forRoot()`/`forBucket()` возвращает DynamicModule с providers + health indicator + (опционально) shutdown service.
- **Symbol DI tokens** (CacheModule, StorageModule): новые foundation-модули используют symbol; gRPC catalog текущая аномалия (string), исправляется в этой фазе.
- **Pino через nestjs-pino** в interceptor-ах: server-side gRPC interceptor уже логирует, client-side зеркалирует подход.

### Integration Points
- Consumer AppModule → `imports: [AudienceClientModule, ...]`
- Consumer use-case → `@Inject(SERVICE.audience.diToken) private readonly audience: AudienceClient`
- HealthController (в каждом сервисе) → добавляется проверка `() => this.grpcHealth.check('audience-grpc', this.audienceClient)`
- `apps/gateway/src/infrastructure/clients/grpc-clients.module.ts` — точка сборки всех 5 клиентов для gateway
- Smoke-контроллер мигрирует на каталог (тестовое подтверждение symbol-токенов)

</code_context>

<specifics>
## Specific Ideas

- Стилистический ориентир — паттерн `BucketStorageModule.forBucket()` из Phase 22 (per-instance модули с инкапсулированным health indicator)
- `Symbol.for(key)` (а не `Symbol(key)`) — критично, иначе разные импорты получат разные symbol и DI развалится
- Smoke-контроллер не получает спецотношения: те же symbol-токены из каталога, никаких локальных строк

</specifics>

<deferred>
## Deferred Ideas

- **Correlation ID propagation в gRPC metadata** — Phase 27 (Distributed Tracing). Сейчас correlationId только в локальных логах client-interceptor.
- **Client-side retry policy** — не входит в success criteria Phase 23. Текущая retry-логика на server/connection уровне (Phase 6) сохраняется. Если потребуется per-call retry — отдельный todo.
- **Метрики (Prometheus-compatible)** — относится к v5.0 (OTEL-03), не к этой фазе.
- **Circuit breaker на gRPC** — REQUIREMENTS.md явно ограничивает: "HTTP-04: Circuit breaker применяется только к внешним HTTP вызовам, не к внутренним gRPC".
- **Streaming RPC** (server/client/bidi streams) — текущие proto-контракты unary; если появятся streams, расширить facade отдельно.

</deferred>

---

*Phase: 23-grpc-client-typed-wrappers*
*Context gathered: 2026-04-15*
