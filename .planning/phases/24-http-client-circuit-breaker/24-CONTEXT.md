# Phase 24: HTTP Client & Circuit Breaker - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Resilient HTTP client framework для исходящих вызовов к **внешним** API. Foundation предоставляет только примитивы (HTTP transport на native fetch/undici, retry policy, circuit breaker, logging interceptor, timeout). Per-service typed-facade адаптеры для Telegram (notifier), AppStoreSpy (parser), Cloud Functions (sender) — в `apps/{service}/src/infrastructure/clients/{api}/`. Типы external API живут в `packages/contracts/src/external/{api}/`.

Out of scope: бизнес-логика отправки Telegram-сообщений / парсинга / отправки писем (только каркас + skeleton-вызовы из адаптеров). Internal gRPC calls — НЕ затронуты (Phase 23 framework). Метрики Prometheus — отложены в OTEL (v5). Cross-instance CB sync — отдельная задача. Bulkhead pattern — отдельный паттерн.

</domain>

<decisions>
## Implementation Decisions

### Архитектурная структура (urок из 999.7)
- **D-01:** Foundation = **только примитивы**, **ноль** знаний про конкретные external APIs. `packages/foundation/src/external/http/` содержит `AbstractHttpClient`, retry policy, circuit breaker wrapper, logging interceptor, timeout helper, constants.
- **D-02:** Типы external APIs — в `packages/contracts/src/external/{api}/types.ts` (Telegram, AppStoreSpy, CloudFn). Симметрично с `packages/contracts/proto/`. Если завтра второй consumer — типы уже шарятся.
- **D-03:** Per-service адаптеры — в `apps/{service}/src/infrastructure/clients/{api}/` (`telegram.client.ts` + `telegram.module.ts` в notifier, аналогично AppStoreSpy в parser, CloudFn в sender). Адаптер `extends AbstractHttpClient` (foundation) + импорт типов из contracts.
- **D-04:** **НЕ повторять** ошибку Phase 23 (per-API модули в foundation) — делаем сразу правильно.

### HTTP transport
- **D-05:** Native `fetch` / `undici` из Node 20. Ноль HTTP-зависимостей в `package.json`. `AbortSignal.timeout(ms)` для timeout, `Response.json()` для парсинга, error по `!response.ok`.
- **D-06:** Никаких axios / @nestjs/axios / got — устаревший выбор после полноценной поддержки fetch в Node 18+.

### Circuit breaker
- **D-07:** Библиотека **opossum** (IBM-maintained, ~7 лет зрелости, наибольшая популярность в Node-экосистеме). API `new CircuitBreaker(fn, opts).fire(args)` + события open/halfOpen/close для логирования.
- **D-08:** Каждый per-service адаптер получает **свой отдельный CB-инстанс** (TelegramClient → один CB, CloudFnClient → другой CB). Изоляция: падение одного external API не открывает CB у другого.

### Retry policy
- **D-09:** Дефолты: **3 попытки**, **exponential backoff 200ms→5s + jitter**, retry **только** на 5xx + network errors, **НЕ** на 4xx.
- **D-10:** **Idempotency-aware**: retry безопасен по умолчанию **только** для GET/HEAD. POST/PATCH/DELETE **НЕ** retry-ятся по умолчанию — иначе двойная отправка (2 telegram-сообщения, 2 письма). Явный opt-in через `idempotent: true` в call options для эндпоинтов которые вендор гарантирует idempotent (или через Idempotency-Key header).

### Timeout
- **D-11:** Дефолт 5с на попытку. Per-adapter override через `forFeature` / конструктор адаптера.

### Circuit breaker thresholds
- **D-12:** Open после **5 consecutive failures** (не error percentage — для простоты на старте). Half-open **через 30 секунд**. Per-adapter override.

### Health
- **D-13:** External APIs **НЕ пробиваются** в `/health/ready`. Telegram/AppStoreSpy/CloudFn вне нашего контроля; readiness не должен зависеть от чужих ratelimits/downtime (иначе K8s рестартует pod из-за стороннего падения). Паттерн Google SRE.
- **D-14:** Состояние CB логируется при transitions (open↔halfOpen↔close) — observability через логи. Метрики/Prometheus отложены в OTEL (v5).

### Logging
- **D-15:** Client-side logging interceptor — Pino per-call: `api`, `method`, `url`, `duration_ms`, `status_code`, `correlationId` из CLS (nestjs-cls глобально подключён). Pattern из `correlation.interceptor.ts` (НЕ `setContext()` на injected PinoLogger — Pitfall 6 из Phase 23).
- **D-16:** Body запросов/ответов **НЕ логируется** (PII, secrets, bot tokens). При необходимости debug — только под флагом, redacted.
- **D-17:** CB transitions — отдельный log event (`http.client.circuit.open`, `http.client.circuit.close`).

### Per-service adapter scope (Phase 24)
- **D-18:** Создаются **skeleton-адаптеры** для всех трёх external API (Telegram, AppStoreSpy, CloudFn) — типы + один-два метода + DI-модуль. Полная бизнес-реализация (все методы вендора) — отдельная задача под бизнес-логику. Цель Phase 24 — каркас работает, паттерн продемонстрирован, framework протестирован на трёх реальных интеграциях.

### DI и configuration
- **D-19:** Bot tokens / API keys / base URLs — через `@email-platform/config` (Phase 20 sub-schemas). Per-service env schema добавляется в `apps/{service}/src/infrastructure/config/{service}-env.schema.ts`. Никаких `process.env.X` напрямую, никаких defaults в Zod (правило проекта).
- **D-20:** DI токены адаптеров — `Symbol.for()` (правило CLAUDE.md, единый стиль с Phase 23).

### Claude's Discretion
- Точная структура файлов внутри `foundation/external/http/` (один файл vs split на client/retry/cb/logging)
- Имена методов на `AbstractHttpClient` (`get`/`post`/`put`/`delete`/`request` — стандартные REST verbs, тривиально)
- Конкретный error type для CircuitOpenError vs HttpError vs TimeoutError (типизированная иерархия)
- Точный jitter algorithm (равномерный vs decorrelated) — opossum дефолт + наша обёртка
- Сколько именно skeleton-методов в каждом адаптере (1-2 на каждый — достаточно для проверки framework)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 24 inputs
- `.planning/REQUIREMENTS.md` § "HTTP Client" — HTTP-01..04
- `.planning/ROADMAP.md` § "Phase 24: HTTP Client & Circuit Breaker" — goal + 4 success criteria

### Архитектурные ориентиры (паттерны для копирования)
- `packages/foundation/src/external/grpc/clients/abstract-grpc-client.ts` (Phase 23) — паттерн AbstractClient + onModuleInit lifecycle; Pitfall 6 (PinoLogger.root.child в onModuleInit, не в конструкторе)
- `packages/foundation/src/external/grpc/clients/grpc-client-logging.types.ts` — структура logging fields (mirror для HTTP)
- `packages/foundation/src/external/cache/` — CacheModule pattern (forRootAsync, Symbol DI tokens, shutdown)
- `packages/foundation/src/external/storage/` — StorageModule pattern (per-bucket модули, external/internal split из Phase 22.1)
- `packages/foundation/src/external/logging/correlation.interceptor.ts` — `PinoLogger.root.child({ context })` precedent

### Existing code в скоупе изменений
- `packages/contracts/` — добавляется `src/external/{telegram,appstorespy,cloud-functions}/types.ts` (новые папки, симметрия с `proto/`)
- `apps/notifier/src/infrastructure/external/telegram-notification.sender.ts` — текущий стаб (`NotImplementedException`); переезжает в `apps/notifier/src/infrastructure/clients/telegram/` и использует новый `TelegramClient`
- `apps/parser/src/infrastructure/` — пока пусто; добавляется `clients/appstorespy/`
- `apps/sender/src/infrastructure/` — добавляется `clients/cloud-functions/`
- `apps/{notifier,parser,sender}/src/infrastructure/config/` — расширяются env schemas (bot tokens, API keys, base URLs)

### Phase 23 backlog reference
- ROADMAP.md § "Phase 999.7" — для gRPC такой же принцип (per-service location) сейчас в техдолге; HTTP делает это сразу

### Project rules
- `CLAUDE.md` § "Code Style" — DI токены через `Symbol.for()`, no magic values, no env branching, no defaults в Zod env schemas
- `CLAUDE.md` § "Architecture Constraints" — apps/ Clean/Hexagonal, packages/ утилитарная

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `nestjs-cls` глобально подключён → correlationId доступен в logging interceptor через `ClsService.getId()`
- `nestjs-pino` + `PinoLogger.root` доступен (учесть Pitfall 6 из Phase 23 — child logger в onModuleInit, не в конструкторе)
- Phase 23 `AbstractGrpcClient` структура — точный шаблон для `AbstractHttpClient` (Promise API, DI, lifecycle, logging, deadline → timeout)
- `@email-platform/config` per-service sub-schemas (Phase 20) — паттерн добавления новых env vars без затрагивания других сервисов

### Established Patterns
- **Per-service infrastructure layer** (Clean/Hexagonal): adapters в `apps/{service}/src/infrastructure/clients/{external-system}/`. Уже существует для других концернов (`apps/audience/src/infrastructure/persistence/`, etc).
- **Foundation external/internal partition** (Phase 22.1): публичный API через `@email-platform/foundation`. Новые HTTP примитивы — public via `external/http/`.
- **Symbol.for() DI токены** (Phase 23) — правило для нового кода.
- **Per-call lifecycle hook для лазерной инициализации** — `onModuleInit` для DI-зависимых вызовов (Pitfall 3 из Phase 23).

### Integration Points
- Adapter consumers (use-cases в каждом сервисе) → `@Inject(TELEGRAM_CLIENT_TOKEN) private telegram: TelegramClient`
- AppModule сервиса → `imports: [TelegramClientModule.forRoot()]` (для notifier), аналогично parser/sender
- Логи попадают в общий Pino-stream сервиса
- Env vars парсятся вместе с остальной конфигурацией сервиса при `loadConfig(...)`

</code_context>

<specifics>
## Specific Ideas

- "Тип-контракты живут в `packages/contracts/`, симметрично с `proto/`. Сейчас не шарятся, завтра могут начать — типы уже на месте."
- Native fetch/undici — наш чёткий выбор, axios/got считаются устаревшими (комментарий пользователя)
- Каркас должен сразу работать на трёх реальных API (Telegram/AppStoreSpy/CloudFn) — не абстрактный пример

</specifics>

<deferred>
## Deferred Ideas

- **Полная бизнес-реализация** Telegram/AppStoreSpy/CloudFn адаптеров (все методы вендора, retry-логика для специфичных сценариев) — отдельная задача под business logic phase
- **Метрики CB / HTTP latency в Prometheus** — относится к v5.0 (OTEL)
- **CB state в /health/ready** — рассмотрено, отклонено (Google SRE pattern: external deps don't gate readiness)
- **Cross-instance CB sync** (если 3 pod sender, у каждого свой CB) — out of scope, отдельная задача
- **Bulkhead pattern** (concurrent calls limit) — отдельный паттерн, не Phase 24
- **Sampled background probe** для health — отклонено как избыточная сложность
- **Idempotency-Key header автогенерация** для POST — отдельная история когда понадобится
- **Response body redaction в логах под debug-флагом** — yagni сейчас, добавим если возникнет реальная отладка

</deferred>

---

*Phase: 24-http-client-circuit-breaker*
*Context gathered: 2026-04-15*
