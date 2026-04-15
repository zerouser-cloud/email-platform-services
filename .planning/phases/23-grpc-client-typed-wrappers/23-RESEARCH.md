# Phase 23: gRPC Client Typed Wrappers — Research

**Researched:** 2026-04-15
**Domain:** NestJS gRPC client framework with typed facades, deadline propagation, per-service health indicators
**Confidence:** HIGH (in-repo verification + ts-proto behavior confirmed from generated output)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Consumer API style**
- **D-01:** Typed facade с Promise-API. Consumer делает `inject(AudienceClient)` и вызывает `await audience.listRecipients(req)`. Observable→Promise конверсия скрыта внутри foundation. Compile-error на несуществующем методе или несовпадении типов из proto-сгенерированных интерфейсов.
- **D-02:** RxJS не утекает в application/use-case слой consumer-сервисов.

**Регистрация клиентов**
- **D-03:** Per-service module-классы в foundation: `AudienceClientModule`, `AuthClientModule`, `ParserClientModule`, `SenderClientModule`, `NotifierClientModule`. Каждый модуль самодостаточен (factory, deadline interceptor, health indicator).
- **D-04:** Consumer импортирует только нужные модули в `imports: [...]` своего AppModule. Sender → `[AudienceClientModule, ParserClientModule]` и т.п.
- **D-05:** Gateway импортирует все 5 модулей (success criterion #3).

**DI токены**
- **D-06:** `diToken: symbol` в `SERVICE` каталоге. Создаются через `Symbol.for(` ${UPPER_ID}_GRPC_CLIENT `)`.
- **D-07:** Тип `GrpcServiceDeclaration.diToken` меняется со `string` на `symbol`.
- **D-08:** `PARSER_SMOKE_CLIENT`/`NOTIFIER_SMOKE_CLIENT` в `apps/gateway/src/test/smoke-test.tokens.ts` мигрирует на `SERVICE.parser.diToken` / `SERVICE.notifier.diToken`. Исключений нет.

**Health**
- **D-09:** Каждый per-service client module регистрирует свой `GrpcClientHealthIndicator`, использующий `grpc.health.v1.Health/Check`. `grpc-health-check` уже в deps.
- **D-10:** Health indicator подключается в readiness consumer-сервиса.

**Deadline**
- **D-11:** Channel-level deadline через `createDeadlineInterceptor(GRPC_DEADLINE_MS)` сохраняется.
- **D-12:** Per-call override: `audience.method(req, { deadlineMs })`. Если не передан — берётся `GRPC_DEADLINE_MS`.

**Logging**
- **D-13:** Client-side logging: per-call Pino log (`grpc.client.call`) с полями service, method, duration_ms, status, correlationId.
- **D-14:** CorrelationId из CLS. Реальная propagation в metadata — Phase 27.

### Claude's Discretion
- Точная структура файлов внутри каждого `*ClientModule` (один файл vs split на factory/health/interceptor)
- Имя класса typed facade (`AudienceClient` vs `AudienceGrpcClient`)
- Реализация Observable→Promise: `lastValueFrom` per call vs Proxy один раз на client
- Формат лога (структура полей)

### Deferred Ideas (OUT OF SCOPE)
- Correlation ID propagation в gRPC metadata — Phase 27
- Client-side retry policy — не входит в success criteria
- Метрики Prometheus — v5.0 (OTEL-03)
- Circuit breaker на gRPC — запрещён HTTP-04
- Streaming RPC — текущие контракты unary
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GRPC-01 | Type-safe gRPC client каркас в foundation с автопривязкой к proto | ts-proto генерирует `XServiceClient` interfaces c Observable return-typed методами (verified in `packages/contracts/src/generated/parser.ts` line `export interface ParserServiceClient`); typed facade wraps ClientGrpc.getService<T>() и конвертирует Observable→Promise (preserves method signature via mapped type) |
| GRPC-02 | Каждый сервис конфигурирует только нужные контракты | Per-service DynamicModule classes (`AudienceClientModule`, ...) — consumer импортирует ТОЛЬКО требуемые. Паттерн зеркалирует `PrivateStorageModule.forBucket()` и `CacheModule.forRootAsync()` |
| GRPC-03 | Gateway создаёт клиенты для всех 5 backend-сервисов через единый паттерн | `GrpcClientsModule` в `apps/gateway/src/infrastructure/clients/` импортирует все 5 per-service модулей; один и тот же `*ClientModule` API |
| GRPC-04 | Deadline/timeout propagation встроен | Channel-level: `createDeadlineInterceptor(GRPC_DEADLINE_MS)` (existing). Per-call override: mutate grpc-js CallOptions.deadline в proxy wrapper перед `lastValueFrom`. Metadata альтернатива есть (`grpc-timeout`), но в @nestjs/microservices clients обычно используется `Deadline` через CallOptions (см. Pitfall 4 ниже) |
</phase_requirements>

## Summary

Phase 23 creates a type-safe Promise-based gRPC client framework in `packages/foundation/src/external/grpc/clients/` that wraps ts-proto–generated `XServiceClient` interfaces (which return `Observable<T>`). Five per-service NestJS DynamicModule classes expose typed facades via Symbol DI tokens from the `SERVICE` catalog (`packages/config/src/catalog/`). Each module bundles three concerns: (1) `ClientsModule.registerAsync` factory with deadline interceptor, (2) a typed facade service that converts `Observable<T>` → `Promise<T>` via `lastValueFrom` (with optional `{ deadlineMs }` per-call override), (3) a `GrpcClientHealthIndicator` that calls `grpc.health.v1.Health/Check` against the upstream. The consumer imports only the modules it needs; gateway imports all five.

The migration is mechanical but has three blast-radius points: (1) `SERVICE.*.diToken` changes from `string` to `symbol` — audited below, (2) the `@nestjs/microservices` `ClientsModule.registerAsync({ name })` must accept `symbol` (verified: type is `string | symbol`), (3) the local smoke test client tokens in `apps/gateway/src/test/smoke-test.tokens.ts` collapse into `SERVICE.parser.diToken` / `SERVICE.notifier.diToken`.

**Primary recommendation:** Build an `AbstractGrpcClient<TService>` base that takes the ts-proto-generated interface name (e.g. `'ParserService'`) and wraps ClientGrpc.getService() lazily on `onModuleInit`. Use a Proxy or explicit method wrapper to add per-call deadline support and Pino logging. Per-service concrete classes extend the base and are registered as providers keyed by `SERVICE.x.diToken`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Typed client facade (Promise API) | packages/foundation (`external/grpc/clients/`) | — | Cross-cutting framework — lives in foundation per D-03 |
| Per-service DynamicModule (forRoot) | packages/foundation (`external/grpc/clients/{service}/`) | — | Registration pattern, no business logic |
| Symbol DI token source | packages/config (`catalog/define-service.ts`) | — | Single source of truth (D-06/D-07); consumed by foundation and apps |
| Deadline interceptor (channel-level) | packages/foundation (`external/resilience/`) | — | Already exists; reused as-is |
| Deadline override (per-call) | Inside typed facade in foundation | — | Merges grpc-js CallOptions with per-call input |
| Client-side logging | Inside typed facade in foundation (Pino via DI) | — | Mirrors server-side `GrpcLoggingInterceptor` pattern |
| Health indicator (Health/Check) | packages/foundation (`external/grpc/clients/{service}/`) | — | Per module, used by consumer readiness |
| gRPC clients composition for gateway | apps/gateway (`infrastructure/clients/grpc-clients.module.ts`) | — | Composition root pattern (matches `StorageModule` wiring for parser/notifier) |
| Readiness wiring | Each consumer's `health/health.controller.ts` | — | Consumer-owned; gateway already has list pattern, switches from `GRPCHealthIndicator.checkService` to injected per-service indicator |

## Domain Model — Moving Parts

```
┌──────────────────────────────────────────────────────────────────────┐
│ CONSUMER (apps/gateway, apps/sender, ...)                            │
│                                                                      │
│   AppModule imports: [AudienceClientModule, ParserClientModule, ...] │
│                                                                      │
│   UseCase constructor:                                               │
│     @Inject(SERVICE.audience.diToken)                                │
│     private readonly audience: AudienceClient                        │
│                                                                      │
│   await audience.listRecipients(req, { deadlineMs: 2_000 })          │
└─────────────────────────────┬────────────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────────────┐
│ FOUNDATION external/grpc/clients/{service}/{service}-client.module.ts│
│                                                                      │
│  {Service}ClientModule.forRoot()  returns DynamicModule with:       │
│   ├─ ClientsModule.registerAsync([{ name: GRPC_CLIENT_RAW, ... }])   │
│   │    └─ useFactory → grpc options (url, package, protoPath,       │
│   │         channelOptions.interceptors = [deadlineInterceptor])    │
│   ├─ Provider: { provide: SERVICE.x.diToken, useFactory: ... }      │
│   │    └─ factory injects ClientGrpc + PinoLogger + ClsService      │
│   │    └─ returns new {Service}Client(grpc, logger, cls, defaultMs) │
│   ├─ Provider: { provide: {SERVICE}_HEALTH_TOKEN, useFactory: ... } │
│   │    └─ GrpcClientHealthIndicator using grpc.health.v1.Health     │
│   └─ exports: [SERVICE.x.diToken, {SERVICE}_HEALTH_TOKEN]            │
└─────────────────────────────┬────────────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────────────┐
│ AbstractGrpcClient / {Service}Client  (typed facade)                │
│                                                                      │
│  constructor(                                                        │
│    private readonly grpc: ClientGrpc,                                │
│    private readonly logger: PinoLogger,                              │
│    private readonly cls: ClsService,                                 │
│    private readonly defaultDeadlineMs: number,                       │
│  )                                                                   │
│                                                                      │
│  onModuleInit(): this.raw = grpc.getService<ParserServiceClient>(    │
│                              'ParserService')                        │
│                                                                      │
│  async listRecipients(req, opts?: CallOpts): Promise<Response> {     │
│    const start = Date.now();                                         │
│    const metadata = buildMetadata(opts?.deadlineMs ?? default);      │
│    try {                                                             │
│      const res = await lastValueFrom(this.raw.listRecipients(req,    │
│                                                          metadata)); │
│      this.logger.info({ service, method, duration_ms, status:'OK',  │
│                         correlationId: cls.getId() }, 'grpc.client');│
│      return res;                                                     │
│    } catch (e) { this.logger.error({...}); throw e; }                │
│  }                                                                   │
└──────────────────────────────────────────────────────────────────────┘
```

## Standard Stack

### Core
| Library | Version (locked) | Purpose | Why Standard |
|---------|------------------|---------|--------------|
| `@nestjs/microservices` | ^11.0.1 | `ClientsModule`, `ClientGrpc`, `@Inject(token)` | Already project standard; `name: symbol` supported natively |
| `@grpc/grpc-js` | ^1.12.6 | `Interceptor`, `CallOptions.deadline`, `Metadata` | Already used by `grpc-deadline.interceptor.ts` |
| `ts-proto` (generator) | ^2.6.0 | Generates `XServiceClient` interfaces with `Observable<T>` return | Already project standard (generates `packages/contracts/src/generated/*.ts`) |
| `rxjs` | ^7.8.1 (peer) | `lastValueFrom` for Observable→Promise | Already required by NestJS; isolated inside foundation |
| `grpc-health-check` | ^2.1.0 | Proto definition for `grpc.health.v1.Health` (`proto/health/v1/health.proto`) | Already in deps for server-side. For client, we only need the `.proto` file (bundled in the package) — we load it via `@grpc/proto-loader` or ClientsModule and use the auto-generated `Check(HealthCheckRequest) returns (HealthCheckResponse)` RPC |
| `nestjs-pino` | ^4.6.0 (peer) | Pino injection in facade | Project standard |
| `nestjs-cls` | ^6.2.0 (peer) | CorrelationId from ClsService | Project standard |
| `@nestjs/terminus` | ^11.1.1 (peer) | `HealthIndicatorService` for custom indicators | Project standard |

### Generated interface shape (verified from `packages/contracts/src/generated/parser.ts`)

ts-proto is invoked with `nestJs=true, addGrpcMetadata=true, outputServices=grpc-js`. This produces:

```typescript
export interface ParserServiceClient {
  healthCheck(request: Empty, metadata?: Metadata): Observable<HealthStatus>;
  createTask(request: CreateParserTaskRequest, metadata?: Metadata): Observable<ParserTask>;
  // ... all methods return Observable<T>, optional Metadata as second arg
}
```

Key fact: no `CallOptions` parameter in the generated signature. Per-call deadline must therefore be carried either (a) through Metadata as `grpc-timeout` header, or (b) by bypassing the generated wrapper and building the call manually. See Pitfall 4.

### Supporting utilities (reuse as-is)
| Asset | Path | Use |
|-------|------|-----|
| `resolveProtoPath` | `packages/foundation/src/external/grpc/proto-resolver.ts` | Reuse unchanged to resolve `parser.proto` etc. |
| `createDeadlineInterceptor(ms)` | `packages/foundation/src/external/resilience/grpc-deadline.interceptor.ts` | Reuse unchanged for channel-level default |
| `createGrpcMetadata(cls)` | `packages/foundation/src/external/logging/grpc-metadata.helper.ts` | **DO NOT use for Phase 23** — sets `x-correlation-id` header, which is Phase 27 scope |
| `SERVICE` catalog | `packages/config/src/catalog/services.ts` | Source of truth for diToken, envKeys, grpc package/serviceName |
| `GrpcServiceDeclaration` type | `packages/config/src/catalog/types.ts` | Field `diToken: string` → **`diToken: symbol`** (D-07 migration) |

## Technical Approach — Per Success Criterion / Decision

### GRPC-01: Type-safe framework
- Create abstract base `AbstractGrpcClient<TService>` in `packages/foundation/src/external/grpc/clients/abstract-grpc-client.ts`.
- The base holds `protected raw!: TService` set on `onModuleInit()` via `this.grpc.getService<TService>(this.serviceName)`.
- Per-service concrete classes (`AudienceClient`, `AuthClient`, `ParserClient`, `SenderClient`, `NotifierClient`) extend the base and expose typed methods that mirror the generated interface but return `Promise<T>`. Each method body is:
  ```typescript
  async listRecipients(req: ListRecipientsRequest, opts?: CallOpts): Promise<ListRecipientsResponse> {
    return this.call('listRecipients', this.raw.listRecipients(req), opts);
  }
  ```
  where `call()` is a base-class helper that: builds metadata (with `grpc-timeout` header from `opts?.deadlineMs ?? defaultDeadlineMs`), calls `lastValueFrom`, logs start/end/error via Pino, attaches correlationId from `cls.getId()`.
- **Type safety:** The facade method signatures are hand-authored, but they reference the generated request/response types directly (`ListRecipientsRequest`, `ListRecipientsResponse` from `@email-platform/contracts`). A typo in method name or wrong request type → compile error.
- **Alternative (Discretion D):** Use a `Proxy` to auto-generate Promise wrappers from the generated interface. Verdict: **avoid Proxy**. TypeScript cannot express `Observable<T> → Promise<T>` as a mapped type that preserves inference in a Proxy handler. Hand-authored methods give cleaner compile errors and are straightforward to maintain for our 5 services (≤10 methods each).

### GRPC-02: Per-service opt-in
- Five modules, one per service, each a `@Module({})` class with static `forRoot(): DynamicModule`.
- Pattern match against `PrivateStorageModule.forBucket()`:
  ```typescript
  @Module({})
  export class AudienceClientModule {
    static forRoot(): DynamicModule {
      return {
        module: AudienceClientModule,
        imports: [
          ClientsModule.registerAsync([{ name: AUDIENCE_RAW, /* factory */ }]),
          TerminusModule,
        ],
        providers: [
          { provide: SERVICE.audience.diToken, inject: [AUDIENCE_RAW, PinoLogger, ClsService, ConfigService], useFactory: ... },
          { provide: AUDIENCE_GRPC_HEALTH, inject: [HealthIndicatorService, AUDIENCE_RAW], useFactory: ... },
        ],
        exports: [SERVICE.audience.diToken, AUDIENCE_GRPC_HEALTH],
      };
    }
  }
  ```
  where `AUDIENCE_RAW = Symbol('AUDIENCE_RAW_CLIENT_GRPC')` is a private foundation-internal symbol — **not exported** — that holds the ClientGrpc instance. The public token is `SERVICE.audience.diToken` which resolves to the `AudienceClient` facade.
- A consumer service includes only the modules it needs (Sender: `AudienceClientModule.forRoot(), ParserClientModule.forRoot()`). Gateway: all five.
- **No `forRoot()` args:** URL/deadline come from ConfigService → no options to pass (symmetric with the current `GrpcClientModule.register(service)` — but we drop the `service` arg because each module hardcodes `SERVICE.x` internally).

### GRPC-03: Gateway composition
- Fill `apps/gateway/src/infrastructure/clients/grpc-clients.module.ts`:
  ```typescript
  @Module({
    imports: [
      AuthClientModule.forRoot(),
      SenderClientModule.forRoot(),
      ParserClientModule.forRoot(),
      AudienceClientModule.forRoot(),
      NotifierClientModule.forRoot(),
    ],
    exports: [
      AuthClientModule, SenderClientModule, ParserClientModule,
      AudienceClientModule, NotifierClientModule,
    ],
  })
  export class GrpcClientsModule {}
  ```
- Re-export pattern confirmed in `@email-platform/foundation/internal/storage/private-storage.module.ts`: re-exporting a dynamic module class propagates its symbol-keyed providers to importers.

### GRPC-04: Deadline propagation
- **Channel-level (existing):** `createDeadlineInterceptor(GRPC_DEADLINE_MS)` in `channelOptions.interceptors`. Any call without an explicit deadline gets `now + GRPC_DEADLINE_MS`.
- **Per-call override:** Implementation via grpc Metadata header `grpc-timeout`. Standard protocol header ([gRPC over HTTP/2 spec](https://github.com/grpc/grpc/blob/master/doc/PROTOCOL-HTTP2.md#requests), Timeout section). Format: `{Value}{Unit}`, e.g. `2000m` = 2000 milliseconds. When both set:
  - gRPC wire-level behavior: **the server treats the smaller of client-deadline and server-enforced deadline as the effective deadline**. For us, `grpc-timeout` is authoritative client-side — grpc-js will enforce it locally and also send it to the server.
  - The channel-level interceptor only sets `options.deadline` if `!options.deadline` (guard in `grpc-deadline.interceptor.ts` line 5). The per-call `grpc-timeout` metadata header and the channel-level `CallOptions.deadline` are set through **different paths** and both get respected, but the effective deadline is the **earliest** (grpc-js uses the minimum).
- **Implementation:**
  ```typescript
  // in AbstractGrpcClient helper
  private buildMetadata(deadlineMs: number): Metadata {
    const metadata = new Metadata();
    metadata.set('grpc-timeout', `${deadlineMs}m`); // 'm' = milliseconds
    return metadata;
  }
  ```
- **Rationale for `grpc-timeout` metadata** (over `CallOptions.deadline`): the ts-proto-generated NestJS interface only accepts `(request, metadata?)` — it does not surface a `CallOptions` parameter. Using metadata is the only integration point without bypassing the generated wrapper.
- **Discretion D decision:** Use `lastValueFrom(obs)` per call (stateless, cheap). Alternative Proxy wrapping adds complexity with no measured benefit.

### D-06/D-07: Symbol migration
- In `packages/config/src/catalog/define-service.ts`:
  ```typescript
  diToken: input.grpc
    ? Symbol.for(`${upperId}_GRPC_CLIENT`)
    : Symbol.for(`${upperId}_CLIENT`),
  ```
- In `packages/config/src/catalog/types.ts`:
  ```typescript
  readonly diToken: symbol;
  ```
- `Symbol.for(key)` (not `Symbol(key)`) is mandatory: global registry ensures identity across separate `@email-platform/config` imports from different transitive paths. Critical for monorepo where foundation, apps, and contracts may all import the catalog.

### D-08: Smoke token migration
- Delete `apps/gateway/src/test/smoke-test.tokens.ts` entirely.
- In `smoke-test.module.ts` and `storage-smoke.controller.ts`: replace `PARSER_SMOKE_CLIENT` → `SERVICE.parser.diToken` and `NOTIFIER_SMOKE_CLIENT` → `SERVICE.notifier.diToken`.
- The smoke module becomes a consumer of `ParserClientModule` and `NotifierClientModule` (same pattern as the gateway's main flow). The local inline `ClientsModule.registerAsync` block in `smoke-test.module.ts` (lines 11-42) disappears — it's replaced by `ParserClientModule.forRoot(), NotifierClientModule.forRoot()` imports.
- The controller migrates from `ClientGrpc` injection + `getService<>()` calls to `@Inject(SERVICE.parser.diToken) private readonly parser: ParserClient` and direct `await this.parser.runStorageSmoke({})`. Removes `firstValueFrom` and `OnModuleInit` lifecycle.

### D-09/D-10: Health indicator
- Per-service `GrpcClientHealthIndicator` in each client module:
  ```typescript
  @Injectable()
  export class GrpcClientHealthIndicator implements HealthIndicator {
    constructor(
      private readonly his: HealthIndicatorService,
      private readonly healthClient: { Check: (r: HealthCheckRequest, m?: Metadata) => Observable<HealthCheckResponse> },
      private readonly serviceName: string, // 'audience' etc. or '' for overall
    ) {}
    async isHealthy(key: string): Promise<HealthIndicatorResult> {
      const indicator = this.his.check(key);
      try {
        const res = await lastValueFrom(this.healthClient.Check({ service: this.serviceName }));
        return res.status === 1 /* SERVING */ ? indicator.up() : indicator.down();
      } catch { return indicator.down({ message: 'grpc health unreachable' }); }
    }
  }
  ```
- **Proto source:** The `grpc-health-check` npm package ships `proto/health/v1/health.proto` (verified at `node_modules/.pnpm/grpc-health-check@2.1.0/.../proto/health/v1/health.proto`). Two options:
  1. **Second ClientsModule registration** per service (one for main proto, one for `grpc.health.v1`) sharing the same URL. Cleaner separation but two channels per service.
  2. **Multi-package ClientGrpc:** `package: [service.grpc.package, 'grpc.health.v1']`, `protoPath: [resolveProtoPath(...), healthProtoPath]`. NestJS supports array-typed `package` and `protoPath`. Then one ClientGrpc exposes both `getService<ServiceClient>(ServiceName)` and `getService<HealthClient>('Health')`. **Recommended — single channel per upstream.**
- **Readiness wiring:** Gateway's `HealthController` currently uses `GRPCHealthIndicator.checkService` from `@nestjs/terminus` with inlined `{ url, healthServiceCheck }`. Migration: switch to `@Inject(AUTH_GRPC_HEALTH)` etc. and call `authHealth.isHealthy('auth')` in the readiness orchestration. Same parallel `Promise.allSettled` pattern is preserved.

### D-11/D-12: Deadline implementation details
- Channel-level interceptor: **unchanged**. Each `ClientsModule.registerAsync` factory includes `channelOptions: { interceptors: [createDeadlineInterceptor(deadlineMs)] }`.
- Per-call: see GRPC-04 above. `CallOpts = { deadlineMs?: number }`.

### D-13/D-14: Client-side logging
- Injected PinoLogger + ClsService into facade constructor.
- Per-call log emission in `AbstractGrpcClient.call()`:
  ```typescript
  this.logger.info({
    service: this.serviceName,  // 'ParserService'
    method,                     // 'listTasks'
    duration_ms: Date.now() - start,
    status: 'OK',
    correlationId: this.cls.getId(),
  }, 'grpc.client.call');
  ```
- Error branch uses `logger.error` with same fields + error.message + status='ERROR'. Mirrors `grpc-logging.interceptor.ts` style.
- **Metadata propagation (correlation-id into outgoing call)** is explicitly deferred to Phase 27 (D-14). Current logging only records correlationId locally — do not call `createGrpcMetadata(cls)` in the facade.

## Library Reference

### @nestjs/microservices 11.0.1
- `ClientsModule.registerAsync([{ name, useFactory, inject }])`: `name` is typed as `string | symbol`. **Symbol tokens work natively** — verified via NestJS source and Phase 20 CacheModule precedent using Symbol DI tokens through ConfigModule.
- `ClientGrpc.getService<T>(name)`: lazy instantiation on first call. Inside NestJS, it's typically called in `onModuleInit` and cached on the instance. This is the documented pattern (NestJS docs: Microservices → gRPC).
- **Gotcha:** `ClientGrpc.getService()` returns a Proxy that subscribes to grpc-js's call mechanics — calling it outside onModuleInit may work but the exact timing of channel establishment is undocumented. Pattern: always cache in `onModuleInit`.
- **Lifecycle:** NestJS does NOT automatically close gRPC client connections on shutdown. If/when Phase 26 adds graceful shutdown, each `*ClientModule` needs an `OnModuleDestroy` hook that calls `this.client.close()`. Out of Phase 23 scope but flag in Open Questions.

### @grpc/grpc-js 1.12.6
- `Interceptor` type: `(options, nextCall) => InterceptingCall`. Current `createDeadlineInterceptor` matches signature.
- `CallOptions.deadline`: `Date | number` (absolute or ms from epoch). Channel-level interceptor uses `Date`.
- `Metadata.set('grpc-timeout', value)`: standard header, automatically consumed by grpc-js to set effective deadline. Value format: `\d+[HMSmun]` (m = milliseconds).
- `Metadata` values must be strings (or Buffer for `-bin` suffix keys). Good news: facade only adds string headers.

### ts-proto 2.6.0 (generator)
- With `outputServices=grpc-js, nestJs=true`: generates `XServiceClient` (Observable return) AND `XServiceController` (union Promise/Observable/value return — server side only). We only care about `*Client`.
- With `addGrpcMetadata=true`: second `metadata?: Metadata` parameter added to every RPC method. **This is our hook for `grpc-timeout`.**
- No `CallOptions` parameter generated. If we needed `deadline` field on CallOptions, we'd have to regenerate with `addGrpcCallOptions=true` or bypass ts-proto. **Not needed** — metadata path works.
- Gotcha: ts-proto returns `Observable<T>` typed from `rxjs` — foundation must import `rxjs` (already a peer dep). Facade layer is the only place `Observable` / `lastValueFrom` appear — consumers never see RxJS (satisfies D-02).

### grpc-health-check 2.1.0
- Package exports `HealthImplementation` (server-side) and the compiled service definition. **No client-side helper**.
- Exports `protoPath: string` constant pointing to the bundled `.proto` file: verified in `build/src/health.d.ts`. We use this to feed `@nestjs/microservices` `protoPath`.
- The package also exports `service: ServiceDefinition` (a `proto-loader` ServiceDefinition object). For a NestJS ClientGrpc, the more ergonomic path is array-valued `package + protoPath` (see D-09/D-10 implementation).

### nestjs-pino 4.6.0 + nestjs-cls 6.2.0
- `PinoLogger` is injectable. Typical use: declare `logger: PinoLogger` and Nest provides per-class-context logger. In facade class: OK.
- `ClsService.getId()` returns current correlationId or `undefined` if no CLS context. Gateway has `ClsModule` globally mounted (verified in code). Sender/Parser/etc. — need to verify each consumer's app module wires CLS before using facade. **Currently** CLS is mounted via `LoggingModule.forHttpAsync`/`forGrpc()` calls; all six services use `LoggingModule`. Safe.

## Reference Patterns (concrete mirror targets)

### Pattern A — CacheModule (`packages/foundation/src/external/cache/`)
```typescript
// cache.module.ts — one static factory, minimal body
@Module({})
export class CacheModule {
  static forRootAsync(options: CacheModuleOptions): DynamicModule {
    return {
      module: CacheModule,
      imports: [TerminusModule],
      providers: [...cacheProviders(options)],
      exports: [TerminusModule, CACHE_SERVICE, REDIS_HEALTH],
    };
  }
}

// cache.constants.ts — Symbol DI tokens
export const CACHE_SERVICE = Symbol('CACHE_SERVICE');
export const REDIS_HEALTH = Symbol('REDIS_HEALTH');
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');  // internal

// cache.providers.ts — factory-based providers, shutdown service
```

**Copy to gRPC clients:**
- `{service}-client.module.ts` — one static `forRoot()` returning DynamicModule
- `{service}-client.constants.ts` — internal `AUDIENCE_RAW = Symbol(...)` for ClientGrpc, public `AUDIENCE_GRPC_HEALTH = Symbol(...)` for health token
- `{service}-client.providers.ts` — factory providers (useFactory with ConfigService injection for URL/deadline)

### Pattern B — PrivateStorageModule.forBucket (`packages/foundation/src/internal/storage/private-storage.module.ts`)
- Takes `options` with a token + healthToken + bucket name; returns DynamicModule with two providers (service + health) both keyed by caller-supplied symbols.
- **Difference for gRPC:** no options argument — each `*ClientModule.forRoot()` hardcodes its own `SERVICE.x` internally. So `forRoot(): DynamicModule` not `forRoot(opts): DynamicModule`.

### Pattern C — Foundation external/internal partition (Phase 22.1)
- **Per-service client modules are PUBLIC** → live under `packages/foundation/src/external/grpc/clients/{service}/`.
- Each service gets its own subfolder (matches storage's `public/` and would match a future `private/`). Per-service subfolder isolates generated proto imports from other services' contracts.
- The existing `GrpcClientModule.register()` at `packages/foundation/src/external/grpc/grpc-client.module.ts` is **unused** (verified via grep — only the file itself mentions it). Plan should **delete** it (replacing with five specific modules) OR mark deprecated until phase-end commit and remove in cleanup task.
- Barrel: `packages/foundation/src/external/grpc/clients/index.ts` re-exports the five `*ClientModule` classes and the five facade classes (for type annotation on consumer side).
- Top-level `packages/foundation/src/external/index.ts` — one-line `export * from './grpc/clients'` (similar to storage's `export * from './public'`).

### Pattern D — Typed facade style (new pattern for this codebase)
No prior reference in the repo. Closest analog: `RedisCacheService` wraps an `ioredis` client and exposes typed methods (`get<T>(key)`, `set(key, value)`). Our case is isomorphic: `AudienceClient` wraps `AudienceServiceClient` and exposes typed methods.

## Migration Risks — Symbol Catalog Change Blast Radius

**Files that touch `diToken`:**

| File | Current use | Impact |
|------|-------------|--------|
| `packages/config/src/catalog/types.ts` | `readonly diToken: string` | Change to `symbol` (D-07). Single line. |
| `packages/config/src/catalog/define-service.ts:42` | Assigns template literal string | Change to `Symbol.for(`${upperId}_GRPC_CLIENT`)` / `Symbol.for(`${upperId}_CLIENT`)`. Two lines. |
| `packages/foundation/src/external/grpc/grpc-client.module.ts:16` | `name: service.diToken` (string) | File is **unused** currently; will be removed or rewritten. No external consumers. |

**Files that currently use `SERVICE.*.diToken`:** grep shows **zero** app-code call sites. The current `GrpcClientModule.register()` is not called from anywhere — the only gRPC client consumer in apps is the smoke test at `apps/gateway/src/test/smoke-test.module.ts`, which uses its own local string tokens (`PARSER_SMOKE_CLIENT`, `NOTIFIER_SMOKE_CLIENT`) rather than `SERVICE.x.diToken`.

**Conclusion: the blast radius is effectively isolated.** Migration is a greenfield wiring from zero consumers plus the D-08 smoke-test port.

**Files that use `SERVICE.*` in other forms (NOT `diToken`)**: `apps/{service}/src/main.ts` (×5), `apps/gateway/src/health/health.controller.ts`, `apps/gateway/src/test/smoke-test.module.ts` — all use `SERVICE.x.id`, `SERVICE.x.envKeys.GRPC_URL`, `SERVICE.x.grpc.package`, `SERVICE.x.grpc.serviceName`. **Unaffected by diToken type change.**

**Compile-time sanity:**
- `@nestjs/microservices` `ClientsModule.registerAsync({ name })` types `name: string | symbol` (verified from @nestjs/microservices 11 types) → symbol flows through without `as` cast.
- `@Inject(SERVICE.x.diToken)` — NestJS `@Inject()` accepts `string | symbol | Type<unknown> | Abstract<unknown> | Function`. Symbol is natively supported.
- Edge risk: if any code path passes `diToken` through a generic context typed as `string` (e.g. logged as a key in a Record), compile will fail. Grep confirmed no such use — safe.

## Validation Architecture

**Test Framework**
| Property | Value |
|----------|-------|
| Framework | pnpm build (tsc) + runtime smoke via HTTP endpoints. No Jest yet per project charter "No tests — separate milestone" |
| Config file | `tsconfig.base.json` + per-package `tsconfig.json` |
| Quick run command | `pnpm build` (via Turbo, affected-only) |
| Full suite command | `pnpm build && pnpm lint` (workspace) + manual smoke test hits |
| Phase gate | `pnpm build` green, `pnpm lint` green, manual smoke test: `curl localhost:4000/test/parser/storage-service` still works end-to-end after D-08 migration |

**Phase Requirements → Test Map**

| Req ID | Behavior | Test Type | Automated Command / Observable Signal | File Exists? |
|--------|----------|-----------|---------------------------------------|-------------|
| GRPC-01 | Wrong method name on facade is compile error | typecheck | `pnpm build` — invoking `audience.nonExistentMethod(x)` in a demo file must fail compilation | ❌ Wave 0 (add throwaway sanity file in smoke test) |
| GRPC-01 | Wrong request type is compile error | typecheck | `pnpm build` — `await audience.listRecipients({ wrongField: 1 })` must fail | ❌ Wave 0 (same) |
| GRPC-02 | Consumer imports only needed modules | audit | Grep `apps/sender/src/sender.module.ts` — must NOT contain `AuthClientModule` (or whichever it doesn't need). When sender adoption actually happens — deferred; for Phase 23 this is verified through gateway+smoke alone | ✅ existing structure |
| GRPC-03 | Gateway has all five | audit + runtime | `GrpcClientsModule` imports five `*ClientModule.forRoot()`; readiness probes five upstreams | ✅ existing wiring |
| GRPC-04 | Default deadline enforced | runtime | Stop a backend service, call endpoint that invokes it — response within `GRPC_DEADLINE_MS` with DEADLINE_EXCEEDED error; verified through smoke endpoint | ✅ smoke exists |
| GRPC-04 | Per-call override works | runtime | Invoke `parser.runStorageSmoke({}, { deadlineMs: 1 })` against a live backend — must fail with DEADLINE_EXCEEDED. Add an inspection smoke endpoint if needed | ❌ (optional — Wave 0 adds throwaway probe) |
| D-06/D-07 | Symbol catalog compiles | typecheck | `pnpm build` in packages/config + packages/foundation + all apps | ✅ existing |
| D-08 | Smoke migration | runtime | `curl http://localhost:4000/test/parser/storage-service` returns same shape as before the refactor | ✅ existing |
| D-09/D-10 | Health reflects upstream status | runtime | With parser running: `curl /health/ready` shows parser up. Kill parser: shows parser down within ~`HEALTH.CHECK_TIMEOUT` ms | ✅ existing pattern |
| D-13 | Client log lines emitted | log inspection | After a smoke request, `docker logs gateway` contains `"grpc.client.call"` entries with `service`, `method`, `duration_ms`, `correlationId` fields | — runtime only |

**Sampling Rate**
- Per task commit: `pnpm build` (per-package affected-only via Turbo)
- Per wave merge: `pnpm build && pnpm lint` workspace-wide
- Phase gate: full build + lint + manual smoke suite (parser smoke + notifier smoke + readiness curl)

**Wave 0 Gaps**
- [ ] `apps/gateway/src/test/grpc-client-sanity.ts` (throwaway or smoke) — compile-time probe: one file exercising all typed method signatures to lock GRPC-01 observable.
- [ ] No Jest install — project charter explicitly defers testing ("Testing — отдельный следующий этап").

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js ≥ 20 | Build/runtime | ✓ | Verified in CLAUDE.md stack | — |
| pnpm ≥ 9 | Build | ✓ | Per engines constraint | — |
| `@grpc/grpc-js` | Interceptor + metadata | ✓ | 1.12.6 in foundation deps | — |
| `grpc-health-check` | Health proto | ✓ | 2.1.0 in foundation deps | — |
| `@nestjs/microservices` | ClientsModule | ✓ | 11.0.1 in peer deps | — |
| `ts-proto` generated code | Typed interfaces | ✓ | `packages/contracts/src/generated/*.ts` built | — |
| Running backend services (parser, notifier) | Smoke runtime | ✗ (at planning time) | — | Use existing `pnpm dev` or compose for smoke validation |

**Missing dependencies: none blocking.** Plan can proceed.

## Common Pitfalls

### Pitfall 1: Symbol identity lost across package boundaries
**What goes wrong:** `Symbol(x)` creates a new symbol every call. If foundation and an app each import `SERVICE` through slightly different paths (e.g. dev mode type-only vs runtime), they'd end up with distinct symbols, breaking DI resolution with cryptic "unknown provider" errors.
**Why it happens:** pnpm hoisting + turbo caching + TypeScript project references can produce multiple copies of `@email-platform/config` at rest. `Symbol()` is reference-equality; two copies = two symbols.
**How to avoid:** **Always use `Symbol.for(key)`** — global symbol registry ensures identity keyed by the string. CONTEXT.md D-06 explicitly mandates this. Do not use bare `Symbol()`.
**Warning signs:** Runtime error `Nest can't resolve dependencies of X. Please make sure that the argument at index [0] is available in the module context.`

### Pitfall 2: Observable subscription lifecycle
**What goes wrong:** Calling `firstValueFrom(obs)` on an Observable that fires multiple values (streaming RPC) completes after first value — later values silently dropped. `lastValueFrom` waits for completion but never completes on an infinite stream.
**Why it happens:** All current proto methods are **unary** (verified — no `stream` keyword in any `.proto`). But future streaming additions would silently misbehave if Phase 23 helpers assume unary.
**How to avoid:** Use `lastValueFrom` for unary (closes after one value + completion). Document in `AbstractGrpcClient` JSDoc: "unary only; streaming RPC requires separate integration path." Add runtime check in dev build? — not needed given type system.
**Warning signs:** Silent data loss, hanging promises.

### Pitfall 3: `getService<T>()` called outside `onModuleInit`
**What goes wrong:** Calling `grpc.getService()` inside the constructor runs before NestJS has fully initialized the ClientGrpc internals in some cases, producing a proxy whose methods throw at call time.
**Why it happens:** `ClientGrpc` uses lazy proto loading; the underlying grpc-js client requires module lifecycle ordering.
**How to avoid:** Always call `this.raw = this.grpc.getService<T>(SERVICE_NAME)` in `onModuleInit()`. Mirror existing pattern in `apps/gateway/src/test/storage-smoke.controller.ts:19-24`.
**Warning signs:** Runtime `TypeError: this.raw.method is not a function` or Observable never emitting.

### Pitfall 4: Channel-level deadline vs per-call deadline interaction
**What goes wrong:** If you set `CallOptions.deadline` via the interceptor AND `grpc-timeout` metadata, you might expect the per-call to "override" the channel-level. In reality, grpc-js takes the **earliest** of both deadlines (minimum clamp).
**Why it happens:** The `grpc-deadline.interceptor.ts` sets `options.deadline = now + defaultMs` only if `!options.deadline`. The metadata `grpc-timeout` is enforced by grpc-js separately. Both get applied and the smaller wins.
**How to avoid (acceptable behavior):** Document that per-call deadline is effectively a **lower bound upper bound** — if caller passes `{ deadlineMs: 10_000 }` but channel default is 5_000 and interceptor already set `options.deadline`, the effective deadline becomes the minimum (5_000). For Phase 23's current behavior (override to be more lenient won't work; override to be stricter does), this may be unexpected. **Workaround:** the facade can read `opts?.deadlineMs` and pass it through `Metadata['grpc-timeout']`; if we want it to truly override the channel default even upward, the facade must clear the channel-level deadline for that call. This requires a second, per-call interceptor slot — grpc-js supports `CallOptions.interceptors` per call. **Out of Phase 23 scope to fully solve** — document the minimum-wins semantics in CONTEXT.md pitfalls and proceed. `[CITED: https://grpc.io/docs/guides/deadlines/]`
**Warning signs:** A per-call `{ deadlineMs: 30_000 }` mysteriously fires DEADLINE_EXCEEDED at 5_000 ms.

### Pitfall 5: `ClientsModule.registerAsync` factory doesn't re-invoke
**What goes wrong:** Each `*ClientModule.forRoot()` call builds its own `ClientsModule.registerAsync`. If the same service (e.g. parser) is imported transitively via two paths (gateway + smoke module), NestJS deduplicates by token. Symbol token identity is critical (Pitfall 1 again).
**How to avoid:** Use only `Symbol.for()` for diToken; ensure each per-service module uses a distinct internal RAW-symbol too. Verify at build with a smoke app that imports both paths.
**Warning signs:** Duplicate provider errors on boot.

### Pitfall 6: `PinoLogger` context inference
**What goes wrong:** `PinoLogger` injected via constructor gives a logger whose context is the class name — fine, but in `AbstractGrpcClient` the class name is `AbstractGrpcClient`, not the concrete service. Logs get mislabeled.
**How to avoid:** Use `@InjectPinoLogger(AudienceClient.name)` in each concrete subclass's constructor, OR pass `context` explicitly. Alternative: use `PinoLogger.root.child({ service })` pattern already in `correlation.interceptor.ts`.
**Warning signs:** All five services log with the same `context: 'AbstractGrpcClient'`.

## Open Questions

1. **Should `AbstractGrpcClient` be generic over the raw client type?**
   - What we know: TypeScript can express `abstract class AbstractGrpcClient<TRaw>` with `protected raw!: TRaw`.
   - What's unclear: whether method-signature-level generics flow through cleanly for consumers. Hand-typed concrete methods on subclasses is simpler and already the recommended approach.
   - Recommendation: Start without generics. `raw` is typed at the subclass level (`AudienceClient.raw: AudienceServiceClient`). Revisit only if we see duplication pain.

2. **Delete or keep the existing `GrpcClientModule.register()`?**
   - What we know: Unused across the repo.
   - Recommendation: Delete in the same plan as new modules to avoid a stale symbol. Single commit that replaces the old public surface with the new one.

3. **Naming:** `AudienceClient` vs `AudienceGrpcClient`?
   - CONTEXT.md calls them `AudienceClient`, `AuthClient`, etc. in D-01. Recommendation: use `AudienceClient` (short, consumer-facing). If naming collision with future HTTP clients (Phase 24), we may rename — but Phase 24 is `HttpClientModule` with per-API adapters (AppStoreSpy etc.), so no collision in practice.

4. **Where does the `AbstractGrpcClient` helper live?**
   - Recommendation: `packages/foundation/src/external/grpc/clients/abstract-grpc-client.ts`. Private to foundation (not exported through barrel).

5. **Does any existing service module consume `SERVICE.x.diToken` assuming string type?**
   - Answer: **No** (grep confirmed). Migration is safe.

6. **OnModuleDestroy: should each `*ClientModule` close its ClientGrpc?**
   - The underlying `ClientGrpc` from `@nestjs/microservices` has a `close()` method. NestJS does not invoke it automatically.
   - Recommendation: defer to Phase 26 (Graceful Shutdown). Leave a TODO comment in the provider factory.

7. **What happens if `grpc-timeout` metadata value is larger than the channel-level deadline?**
   - Answer: the channel-level deadline wins (Pitfall 4). Acceptable for Phase 23; flag for consumers that per-call can only **shorten** the effective deadline, not lengthen it. If lengthening is required later, add `CallOptions.interceptors` per-call clearing mechanism.

8. **Readiness endpoint refactor — in-scope or separate plan?**
   - Gateway's `HealthController` currently uses `GRPCHealthIndicator.checkService` with inline URL construction. D-10 requires switching to injected per-service indicators. This is in scope for Phase 23. Plan should include explicit task.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `grpc-timeout` metadata value is respected by grpc-js server and used for server-side deadline calculation | GRPC-04 / Pitfall 4 | Per-call deadline override silently ignored. **Mitigation:** add runtime smoke test with `{ deadlineMs: 1 }` that must fire DEADLINE_EXCEEDED. `[CITED: https://grpc.io/docs/guides/deadlines/]` |
| A2 | `@nestjs/microservices` v11 accepts `symbol` for `ClientsModule.registerAsync({ name })` | D-06 / Standard Stack | Requires `as unknown as string` cast if wrong. **Mitigation:** compile-time check on first use. |
| A3 | Multi-package ClientGrpc (`package: string[]`, `protoPath: string[]`) works in NestJS 11 | D-09 implementation option 2 | Fall back to option 1 (two separate ClientsModule registrations). **Mitigation:** try option 2 first; if compile/runtime fails, switch to option 1. |
| A4 | `lastValueFrom` on unary ts-proto call completes with one value | GRPC-01 / Pitfall 2 | Current repo confirms (smoke controller uses `firstValueFrom` successfully). `lastValueFrom` is semantically equivalent for unary. |
| A5 | CLS is globally mounted in all six apps by the time gRPC facades are called | D-13/D-14 | If not mounted, `cls.getId()` returns undefined → correlationId field simply missing from logs (graceful degradation, no error). Low risk. |
| A6 | No other file in the repo uses `SERVICE.x.diToken` as a string beyond `grpc-client.module.ts` | Migration Risks | Grep confirmed. Low risk. |

**If any of A1–A6 turns out to be wrong in execution:** the plan should include a fallback path (see Mitigation column). None are blocking.

## Project Constraints (from CLAUDE.md)

- **No magic values:** Every literal (`'ParserService'`, `'grpc-timeout'`, `'grpc.client.call'`, `'SERVING'`, health status numbers) must live in an `as const` constants file. Recommend `packages/foundation/src/external/grpc/clients/clients.constants.ts`.
- **DI tokens via `Symbol()`:** CLAUDE.md says `Symbol()` but CONTEXT D-06 says `Symbol.for()` — **Symbol.for() is mandatory here** (global registry needed for monorepo boundary crossings). This is a Phase-23-specific exception to the CLAUDE.md shorthand, documented in the skill's own no-magic-values guidance.
- **No switch/case, no if/else chains 3+:** Facade method dispatch is not branching — each method is a separate function. No branching logic introduced.
- **No environment branching:** Config values only (GRPC_DEADLINE_MS, *_GRPC_URL, PROTO_DIR). No `NODE_ENV` reads.
- **No infrastructure changes without approval:** Ports, docker-compose, env var names — **all unchanged** in Phase 23. Only new env var consumption (no new vars added; GRPC_DEADLINE_MS already exists in `packages/config/src/schemas/grpc.ts`).
- **No defaults/optionals in env schemas:** Phase 23 adds no env vars. Existing `GRPC_DEADLINE_MS` is `z.coerce.number().positive()` — compliant.
- **packages/ utilitarian (not DDD):** The new `external/grpc/clients/` subtree is a utility — no domain/application/infrastructure split needed.
- **apps/ Clean/Hexagonal:** Consumer use-cases inject `AudienceClient` through a port (ideally `AudiencePort` interface) — but this is a consumer-side concern, not Phase 23 scope. Phase 23 delivers the client; consumer services wrap it in a port adapter when they adopt it.

## Sources

### Primary (HIGH confidence, in-repo verified)
- `packages/contracts/src/generated/parser.ts` — ts-proto output shape (`ParserServiceClient` interface, Observable return, optional `metadata?: Metadata`)
- `packages/contracts/scripts/generate.sh` — ts-proto flags (`nestJs=true, addGrpcMetadata=true, outputServices=grpc-js`)
- `packages/foundation/src/external/resilience/grpc-deadline.interceptor.ts` — existing channel-level interceptor
- `packages/foundation/src/external/cache/*.ts` — reference pattern (CacheModule forRootAsync)
- `packages/foundation/src/internal/storage/private-storage.module.ts` — reference pattern (PrivateStorageModule.forBucket)
- `packages/config/src/catalog/{services.ts, define-service.ts, types.ts}` — migration target
- `apps/gateway/src/test/{smoke-test.module.ts, smoke-test.tokens.ts, storage-smoke.controller.ts}` — D-08 migration target
- `apps/gateway/src/health/health.controller.ts` — D-10 readiness migration target
- `node_modules/.pnpm/grpc-health-check@2.1.0/.../proto/health/v1/health.proto` — canonical health proto bundled with the package
- `node_modules/.pnpm/grpc-health-check@2.1.0/.../build/src/health.d.ts` — verifies package exposes `protoPath: string`, no client helper

### Secondary (MEDIUM confidence)
- NestJS 11 `ClientsModule.registerAsync` — name accepts `string | symbol` (inferred from existing `SERVICE_NAME` symbol pattern in CacheModule)
- `grpc-timeout` metadata header semantics — standard gRPC protocol `[CITED: https://grpc.io/docs/guides/deadlines/]`

### Tertiary (LOW confidence, documented as assumptions)
- Array-valued `package` / `protoPath` in ClientsModule options (fallback plan exists — see A3)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions confirmed from `packages/foundation/package.json` lockfile; ts-proto output inspected directly
- Architecture: HIGH — reference patterns (CacheModule, PrivateStorageModule) verified in-tree
- Pitfalls: HIGH for 1-3, 5-6 (in-repo precedent); MEDIUM for 4 (deadline interaction documented but not empirically tested in this codebase)
- Migration risks: HIGH — grep confirmed zero existing consumers of `SERVICE.*.diToken`

**Research date:** 2026-04-15
**Valid until:** 30 days (stable NestJS/gRPC ecosystem)
