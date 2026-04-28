# Phase 24: HTTP Client & Circuit Breaker — Research

**Researched:** 2026-04-15
**Domain:** Resilient HTTP client framework for outbound calls to external APIs (Telegram, AppStoreSpy, Cloud Functions). Native `fetch` + `opossum` circuit breaker + custom retry layer + Pino logging, mirroring the Phase 23 gRPC pattern.
**Confidence:** HIGH (in-repo Phase 23 mirror verified; opossum API verified via official docs; native fetch behavior verified locally on Node 22.22)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Architectural structure (lesson from 999.7)**
- **D-01:** Foundation = **only primitives**, **zero** knowledge of concrete external APIs. `packages/foundation/src/external/http/` contains `AbstractHttpClient`, retry policy, circuit breaker wrapper, logging interceptor, timeout helper, constants.
- **D-02:** External-API types live in `packages/contracts/src/external/{api}/types.ts` (Telegram, AppStoreSpy, CloudFn). Symmetric with `packages/contracts/proto/`. If a second consumer appears tomorrow, types are already shared.
- **D-03:** Per-service adapters live in `apps/{service}/src/infrastructure/clients/{api}/` (`telegram.client.ts` + `telegram.module.ts` in notifier; analogous for AppStoreSpy in parser, CloudFn in sender). Adapter `extends AbstractHttpClient` (foundation) + imports types from contracts.
- **D-04:** **Do NOT repeat** the Phase 23 mistake (per-API modules in foundation) — get it right the first time.

**HTTP transport**
- **D-05:** Native `fetch` / `undici` from Node 20+. Zero HTTP dependencies in `package.json`. `AbortSignal.timeout(ms)` for timeout, `Response.json()` for parsing, error via `!response.ok`.
- **D-06:** No axios / @nestjs/axios / got — outdated after first-class fetch in Node 18+.

**Circuit breaker**
- **D-07:** `opossum` library (IBM/NodeShift, mature, most popular in Node ecosystem). API `new CircuitBreaker(fn, opts).fire(args)` + events open/halfOpen/close for logging.
- **D-08:** Each per-service adapter gets its **own dedicated CB instance**. Isolation: failure of one external API does not open another's CB.

**Retry policy**
- **D-09:** Defaults: **3 attempts**, **exponential backoff 200ms→5s + jitter**, retry **only** on 5xx + network errors, **NOT** on 4xx.
- **D-10:** **Idempotency-aware**: retry safe by default **only** for GET/HEAD. POST/PATCH/DELETE **not** retried by default. Explicit opt-in via `idempotent: true` in call options.

**Timeout**
- **D-11:** Default 5s per attempt. Per-adapter override via `forFeature` / adapter constructor.

**Circuit breaker thresholds**
- **D-12:** Open after **5 consecutive failures** (not error percentage — for simplicity at start). Half-open after 30 seconds. Per-adapter override.

**Health**
- **D-13:** External APIs **NOT probed** in `/health/ready`. Google SRE pattern.
- **D-14:** CB state logged at transitions (open↔halfOpen↔close).

**Logging**
- **D-15:** Client-side logging interceptor — Pino per-call: `api`, `method`, `url`, `duration_ms`, `status_code`, `correlationId` from CLS. Pattern from `correlation.interceptor.ts` (NOT `setContext()` on injected PinoLogger — Pitfall 6 from Phase 23).
- **D-16:** Request/response bodies **not** logged (PII, secrets, bot tokens).
- **D-17:** CB transitions — separate log event (`http.client.circuit.open`, `http.client.circuit.close`).

**Per-service adapter scope**
- **D-18:** Skeleton adapters for all three external APIs (Telegram, AppStoreSpy, CloudFn) — types + 1-2 methods each + DI module. Full vendor implementation deferred.

**DI and configuration**
- **D-19:** Bot tokens / API keys / base URLs via `@email-platform/config` (Phase 20 sub-schemas). Per-service env schema extended in `apps/{service}/src/infrastructure/config/{service}-env.schema.ts`. No direct `process.env`, no defaults in Zod.
- **D-20:** DI tokens via `Symbol.for()` (CLAUDE.md rule, single style with Phase 23).

### Claude's Discretion
- Exact file structure inside `foundation/external/http/` (single file vs split into client/retry/cb/logging)
- Method names on `AbstractHttpClient` (`get`/`post`/`put`/`delete`/`request` — standard REST verbs)
- Concrete error type for `CircuitOpenError` vs `HttpError` vs `TimeoutError` (typed hierarchy)
- Exact jitter algorithm (uniform vs decorrelated)
- How many skeleton methods per adapter (1-2 each is sufficient)

### Deferred Ideas (OUT OF SCOPE)
- Full business implementation of Telegram/AppStoreSpy/CloudFn adapters
- Prometheus metrics for CB / HTTP latency — v5.0 (OTEL)
- CB state in `/health/ready` — rejected (Google SRE pattern)
- Cross-instance CB sync — separate task
- Bulkhead pattern (concurrency limit)
- Sampled background probe for health
- `Idempotency-Key` header autogeneration for POST
- Response body redaction in logs under debug flag
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HTTP-01 | HTTP client framework in foundation with retry, timeout, logging | `AbstractHttpClient` in `packages/foundation/src/external/http/` mirrors `AbstractGrpcClient` (verified Phase 23 pattern). Native `fetch` + `AbortSignal.timeout(ms)` provides per-attempt timeout. Custom retry loop wraps fetch (opossum's own `timeout` is per-CB-call, not per-attempt). Pino per-call log via `PinoLogger.root.child({ context })` set in `onModuleInit` (Pitfall 6). |
| HTTP-02 | Circuit breaker integrated in HTTP abstraction | `opossum@9.0.0` wraps the fetch+retry function (`new CircuitBreaker(attemptFn, opts)`). One CB instance **per adapter** (D-08). **Critical finding:** opossum is rolling-window percentage-based, NOT consecutive-failure-based. We must implement the consecutive counter as a small wrapper layer on top (see Pitfall 3). |
| HTTP-03 | Per-service adapters for AppStoreSpy, Telegram, Cloud Functions built on the framework | Three adapters in `apps/{notifier,parser,sender}/src/infrastructure/clients/{api}/` extend `AbstractHttpClient`, import typed request/response from `@email-platform/contracts/external/{api}`. DI module `forRoot()` factory wires base URL + token + adapter-level overrides. |
| HTTP-04 | CB applies only to external HTTP, not internal gRPC | gRPC pipeline (Phase 23) does not import or instantiate `opossum`. Verified via foundation barrel — gRPC-side has zero opossum touchpoints. Audit step in Validation Architecture: `grep -r "opossum" packages/foundation/src/external/grpc` must return zero hits. |
</phase_requirements>

## Summary

Phase 24 adds an HTTP client framework in `packages/foundation/src/external/http/` that wraps native `fetch` (Node 20+) with three concentric layers: (1) per-attempt timeout via `AbortSignal.timeout(ms)`, (2) idempotency-aware retry policy with exponential backoff + jitter, (3) per-adapter `opossum` circuit breaker. Per-service typed adapters (`TelegramClient`, `AppStoreSpyClient`, `CloudFnClient`) live in their consuming app's `infrastructure/clients/{api}/`, extending `AbstractHttpClient` and importing request/response types from a new `packages/contracts/src/external/{api}/` namespace. Each adapter gets its own CB instance and own DI module (`forRoot()` factory injects base URL + token from per-service env schema).

**Critical research finding:** `opossum@9.0.0` uses a rolling-window error-percentage threshold (`errorThresholdPercentage` over `rollingCountTimeout`), **not a consecutive-failure counter**. CONTEXT.md D-12 specifies "5 consecutive failures." Two paths exist: (a) use opossum's built-in `errorThresholdPercentage: 100` + `volumeThreshold: 5` + `rollingCountTimeout: 30_000` — opens after 5 failed calls within 30s with 100% error rate, which approximates "5 consecutive" for low-traffic external APIs but not exactly; or (b) wrap the call function with a small consecutive-counter that throws a sentinel after N consecutive failures, letting opossum trip on that. **Recommendation: option (b)** — preserves D-12 exactness, costs ~10 LOC. Documented in Pitfall 3.

**Primary recommendation:** Build `AbstractHttpClient` as a Promise-only base mirroring `AbstractGrpcClient` exactly. Constructor takes `(cls, baseUrl, defaultTimeoutMs, logContext, cbOptions?)`; `onModuleInit` wires the Pino child logger and creates the per-instance `opossum` CB wrapping a single `executeAttempt(method, url, init)` function. Public methods `get/post/put/delete/request` are thin wrappers that build the `RequestInit` and forward through the CB. Logging, retry, timeout, and CB events all flow through the base — adapters add zero infrastructure code, only typed method signatures.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `AbstractHttpClient` base (Promise API) | packages/foundation (`external/http/abstract-http-client.ts`) | — | Cross-cutting framework — D-01 |
| Retry policy + idempotency gate | packages/foundation (`external/http/retry-policy.ts`) | — | Primitive logic, no per-API knowledge |
| Circuit breaker wrapper (opossum + consecutive-counter) | packages/foundation (`external/http/circuit-breaker.factory.ts`) | — | Primitive logic, instantiated per-adapter |
| Per-call logging (Pino + CLS) | packages/foundation (inside `AbstractHttpClient`) | — | Mirror of gRPC client logging |
| Typed external-API request/response | packages/contracts (`src/external/{api}/types.ts`) | — | D-02: symmetric to `proto/`; consumer-agnostic |
| Per-service typed facade | apps/{service}/src/infrastructure/clients/{api}/{api}.client.ts | — | D-03: lesson from 999.7 |
| Per-service DynamicModule (forRoot) | apps/{service}/src/infrastructure/clients/{api}/{api}.module.ts | — | Composition root, injects env + adapter-specific opts |
| Env schema extension (token, base URL) | apps/{service}/src/infrastructure/config/{service}-env.schema.ts | — | Phase 20 sub-schema pattern |
| Health probe of external API | NOT IN SCOPE | — | D-13: external APIs do not gate readiness |

## Domain Model — Moving Parts

```
┌──────────────────────────────────────────────────────────────────────────┐
│ CONSUMER (apps/notifier use case, etc.)                                  │
│                                                                          │
│   AppModule imports: [TelegramClientModule.forRoot()]                    │
│                                                                          │
│   UseCase ctor:                                                          │
│     @Inject(TELEGRAM_CLIENT) private readonly telegram: TelegramClient   │
│                                                                          │
│   await telegram.sendMessage({ chat_id, text })                          │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────────────────┐
│ apps/notifier/src/infrastructure/clients/telegram/                       │
│                                                                          │
│   TelegramClient extends AbstractHttpClient {                            │
│     async sendMessage(req: SendMessageRequest): Promise<MessageResponse> │
│       return this.post('/sendMessage', req, { idempotent: false });      │
│   }                                                                      │
│                                                                          │
│   TelegramClientModule.forRoot() — DynamicModule:                        │
│     - factory: inject ConfigService, ClsService                          │
│     - useFactory: new TelegramClient({                                   │
│         baseUrl: TELEGRAM_BASE_URL,                                      │
│         authHeader: `Bearer ${TELEGRAM_BOT_TOKEN}`,                      │
│         defaultTimeoutMs, cbOptions, logContext: 'TelegramClient'        │
│       })                                                                 │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │ extends
┌──────────────────────────────▼───────────────────────────────────────────┐
│ packages/foundation/src/external/http/abstract-http-client.ts            │
│                                                                          │
│ class AbstractHttpClient implements OnModuleInit {                       │
│   private logger!: PinoNativeLogger;                                     │
│   private breaker!: CircuitBreaker<                                      │
│     [HttpMethod, string, RequestInit, CallOpts], Response                │
│   >;                                                                     │
│   private consecutiveFailures = 0;                                       │
│                                                                          │
│   onModuleInit() {                                                       │
│     this.logger = PinoLogger.root.child({ context: this.logContext });   │
│     this.breaker = new CircuitBreaker(this.executeWithRetry.bind(this), {│
│       errorThresholdPercentage: 100,                                     │
│       volumeThreshold: this.cbOptions.consecutiveThreshold,              │
│       resetTimeout: this.cbOptions.halfOpenAfterMs,                      │
│       timeout: false,  // we do per-attempt timeout via AbortSignal      │
│     });                                                                  │
│     this.breaker.on('open',     () => this.logCbTransition('open'));     │
│     this.breaker.on('halfOpen', () => this.logCbTransition('halfOpen')); │
│     this.breaker.on('close',    () => this.logCbTransition('close'));    │
│   }                                                                      │
│                                                                          │
│   protected request<T>(method, path, init, opts) {                       │
│     return this.breaker.fire(method, path, init, opts).then(parseJson);  │
│   }                                                                      │
│                                                                          │
│   private async executeWithRetry(method, path, init, opts) {             │
│     const policy = resolveRetryPolicy(method, opts);                     │
│     for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {    │
│       try {                                                              │
│         return await this.executeAttempt(method, path, init, opts);      │
│       } catch (err) {                                                    │
│         if (!shouldRetry(err, attempt, policy)) throw err;               │
│         await sleep(backoffMs(attempt) + jitter());                      │
│       }                                                                  │
│     }                                                                    │
│   }                                                                      │
│                                                                          │
│   private async executeAttempt(method, path, init, opts) {               │
│     const start = Date.now();                                            │
│     const url = `${this.baseUrl}${path}`;                                │
│     const signal = AbortSignal.timeout(opts.timeoutMs ?? this.defaultTM);│
│     try {                                                                │
│       const res = await fetch(url, { method, ...init, signal });         │
│       this.emitCallLog(method, url, res.status, start);                  │
│       if (!res.ok) throw new HttpError(res.status, url);                 │
│       return res;                                                        │
│     } catch (err) {                                                      │
│       this.emitCallLog(method, url, errStatus(err), start, 'ERROR');     │
│       throw normalizeError(err);                                         │
│     }                                                                    │
│   }                                                                      │
│ }                                                                        │
└──────────────────────────────────────────────────────────────────────────┘
```

## Standard Stack

### Core
| Library | Version (verified) | Purpose | Why Standard |
|---------|--------------------|---------|--------------|
| Node 20+ native `fetch` | Built-in (Node ≥ 21 stable per nodejs.org) | HTTP transport | D-05/D-06 — zero deps, modern, browser-compatible | `[VERIFIED: node --version → v22.22.0; typeof fetch === 'function']` `[CITED: https://nodejs.org/api/globals.html#fetch — "v21.0.0 — No longer experimental"]` |
| `AbortSignal.timeout(ms)` | Built-in (Node ≥ 17.3) | Per-attempt timeout | D-11 — native, composable | `[VERIFIED: typeof AbortSignal.timeout === 'function']` |
| `opossum` | `9.0.0` (latest, published 2025-06-05) | Circuit breaker | D-07 — IBM/NodeShift maintained, ~9 years mature | `[VERIFIED: npm view opossum version → 9.0.0; engines: ^24||^22||^20]` |
| `@types/opossum` | `8.1.9` (devDep) | TypeScript types (opossum ships JS only) | Required for type-safety | `[VERIFIED: npm view @types/opossum version → 8.1.9]` — note version skew is normal for DefinitelyTyped |

### Reused (no new install)
| Asset | Path | Use |
|-------|------|-----|
| `nestjs-cls` | peerDep ^6.2.0 | `ClsService.getId()` for correlationId in per-call log |
| `nestjs-pino` | peerDep ^4.6.0 | `PinoLogger.root.child({ context })` in `onModuleInit` (Pitfall 6 from Phase 23) |
| `@email-platform/config` | workspace:* | Per-service env sub-schema composition (Phase 20 pattern) |

### Explicitly NOT used
| Library | Why not |
|---------|---------|
| `axios`, `@nestjs/axios`, `got`, `node-fetch` | D-06: outdated since native fetch; adds bundle weight |
| Explicit `undici` package import | Native `fetch` already uses undici under the hood. We only add `import undici from 'undici'` if we need the lower-level `Pool`/`Agent` for keep-alive tuning — **not needed for skeleton scope (D-18)**; defer to a future tuning phase. |
| `cockatiel`, `p-retry`, `async-retry` | We hand-roll a ~30-LOC retry loop because (1) D-09/D-10 require idempotency-method gating which generic libraries don't model, (2) we already wrap retry inside opossum, so coupling via small inline loop is cleaner than two retry libs. |

**Installation:**
```bash
pnpm --filter @email-platform/foundation add opossum
pnpm --filter @email-platform/foundation add -D @types/opossum
```
(opossum + @types/opossum live in foundation only; adapters consume the abstract base, not opossum directly.)

## Reference Patterns (concrete signatures to copy)

### `AbstractHttpClient` (mirror of `AbstractGrpcClient`)

```typescript
// packages/foundation/src/external/http/abstract-http-client.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PinoLogger } from 'nestjs-pino';
import type { Logger as PinoNativeLogger } from 'pino';
import CircuitBreaker from 'opossum';
import { HTTP_CLIENT_LOG, HTTP_CLIENT_DEFAULTS } from './http-client.constants';
import type {
  CallOpts, HttpMethod, HttpClientOptions, CbOptions, RetryPolicy,
} from './http-client.types';
import { resolveRetryPolicy, shouldRetry, backoffWithJitter } from './retry-policy';
import { HttpError, TimeoutError, NetworkError, CircuitOpenError } from './http-client.errors';

@Injectable()
export abstract class AbstractHttpClient implements OnModuleInit {
  private logger!: PinoNativeLogger;
  private breaker!: CircuitBreaker;
  private consecutiveFailures = 0;

  constructor(
    private readonly cls: ClsService,
    protected readonly baseUrl: string,
    protected readonly defaultTimeoutMs: number,
    protected readonly defaultRetryPolicy: RetryPolicy,
    protected readonly cbOptions: CbOptions,
    private readonly logContext: string,
    private readonly authHeader?: string,
  ) {}

  onModuleInit(): void {
    // Pitfall 6 (Phase 23): defer logger creation
    this.logger = PinoLogger.root.child({ context: this.logContext });
    this.breaker = new CircuitBreaker(
      (m: HttpMethod, p: string, i: RequestInit, o: CallOpts) =>
        this.executeWithRetry(m, p, i, o),
      {
        // Approximate "consecutive" via percentage=100 + volumeThreshold=N
        errorThresholdPercentage: HTTP_CLIENT_DEFAULTS.CB_ERROR_PERCENT,
        volumeThreshold: this.cbOptions.consecutiveThreshold,
        resetTimeout: this.cbOptions.halfOpenAfterMs,
        rollingCountTimeout: HTTP_CLIENT_DEFAULTS.CB_ROLLING_WINDOW_MS,
        rollingCountBuckets: HTTP_CLIENT_DEFAULTS.CB_ROLLING_BUCKETS,
        timeout: false, // we do per-attempt timeout via AbortSignal
      },
    );
    this.breaker.on('open', () => this.logCbTransition(HTTP_CLIENT_LOG.CB_OPEN));
    this.breaker.on('halfOpen', () => this.logCbTransition(HTTP_CLIENT_LOG.CB_HALF_OPEN));
    this.breaker.on('close', () => this.logCbTransition(HTTP_CLIENT_LOG.CB_CLOSE));
  }

  protected get<T>(path: string, opts?: CallOpts): Promise<T> {
    return this.request<T>('GET', path, {}, opts);
  }
  protected post<T>(path: string, body: unknown, opts?: CallOpts): Promise<T> {
    return this.request<T>('POST', path, jsonInit(body), opts);
  }
  protected put<T>(path: string, body: unknown, opts?: CallOpts): Promise<T> {
    return this.request<T>('PUT', path, jsonInit(body), opts);
  }
  protected delete<T>(path: string, opts?: CallOpts): Promise<T> {
    return this.request<T>('DELETE', path, {}, opts);
  }

  protected async request<T>(
    method: HttpMethod, path: string, init: RequestInit, opts: CallOpts = {},
  ): Promise<T> {
    try {
      const res = await this.breaker.fire(method, path, init, opts) as Response;
      return (await res.json()) as T;
    } catch (err) {
      if ((err as Error).message?.includes('Breaker is open')) {
        throw new CircuitOpenError(this.logContext);
      }
      throw err;
    }
  }
  // ... executeWithRetry, executeAttempt, emitCallLog, logCbTransition
}
```

### `http-client.constants.ts`

```typescript
export const HTTP_CLIENT_LOG = {
  EVENT_CALL: 'http.client.call',
  EVENT_CB_TRANSITION: 'http.client.circuit',
  STATUS_OK: 'OK',
  STATUS_ERROR: 'ERROR',
  CB_OPEN: 'open',
  CB_HALF_OPEN: 'halfOpen',
  CB_CLOSE: 'close',
} as const;

export const HTTP_CLIENT_DEFAULTS = {
  TIMEOUT_MS: 5_000,                  // D-11
  RETRY_MAX_ATTEMPTS: 3,              // D-09
  RETRY_BACKOFF_MIN_MS: 200,          // D-09
  RETRY_BACKOFF_MAX_MS: 5_000,        // D-09
  RETRY_JITTER_RATIO: 0.5,            // equal jitter
  CB_CONSECUTIVE_THRESHOLD: 5,        // D-12
  CB_HALF_OPEN_AFTER_MS: 30_000,      // D-12
  CB_ERROR_PERCENT: 100,              // see Pitfall 3
  CB_ROLLING_WINDOW_MS: 30_000,
  CB_ROLLING_BUCKETS: 10,
  IDEMPOTENT_METHODS: ['GET', 'HEAD'] as const,  // D-10
} as const;
```

### `http-client.types.ts`

```typescript
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';

export interface CallOpts {
  readonly timeoutMs?: number;
  readonly idempotent?: boolean;     // D-10 — opt-in for non-GET/HEAD retry
  readonly retries?: number;
  readonly headers?: Record<string, string>;
}

export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly backoffMinMs: number;
  readonly backoffMaxMs: number;
  readonly jitterRatio: number;
}

export interface CbOptions {
  readonly consecutiveThreshold: number;
  readonly halfOpenAfterMs: number;
}

export interface HttpClientLogFields {
  readonly api: string;
  readonly method: HttpMethod;
  readonly url: string;
  readonly duration_ms: number;
  readonly status_code: number | undefined;
  readonly status: 'OK' | 'ERROR';
  readonly correlationId: string | undefined;
}
```

### Per-service module (e.g. `apps/notifier/src/infrastructure/clients/telegram/telegram.module.ts`)

```typescript
import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { TelegramClient } from './telegram.client';
import { TELEGRAM_CLIENT } from './telegram.constants';
import { HTTP_CLIENT_DEFAULTS } from '@email-platform/foundation';

const provider: Provider = {
  provide: TELEGRAM_CLIENT,
  inject: [ConfigService, ClsService],
  useFactory: (config: ConfigService, cls: ClsService) =>
    new TelegramClient(
      cls,
      config.get<string>('TELEGRAM_BASE_URL')!,
      HTTP_CLIENT_DEFAULTS.TIMEOUT_MS,
      { /* RetryPolicy defaults */ },
      { consecutiveThreshold: HTTP_CLIENT_DEFAULTS.CB_CONSECUTIVE_THRESHOLD,
        halfOpenAfterMs: HTTP_CLIENT_DEFAULTS.CB_HALF_OPEN_AFTER_MS },
      'TelegramClient',
      `Bearer ${config.get<string>('TELEGRAM_BOT_TOKEN')!}`,
    ),
};

@Module({})
export class TelegramClientModule {
  static forRoot(): DynamicModule {
    return { module: TelegramClientModule, providers: [provider], exports: [TELEGRAM_CLIENT] };
  }
}
```

```typescript
// telegram.constants.ts
export const TELEGRAM_CLIENT = Symbol.for('TELEGRAM_CLIENT'); // D-20
```

```typescript
// telegram.client.ts (skeleton — D-18: 1 method)
import { Injectable } from '@nestjs/common';
import { AbstractHttpClient } from '@email-platform/foundation';
import type { TelegramTypes } from '@email-platform/contracts';

@Injectable()
export class TelegramClient extends AbstractHttpClient {
  sendMessage(req: TelegramTypes.SendMessageRequest): Promise<TelegramTypes.MessageResponse> {
    return this.post('/sendMessage', req); // POST not idempotent — no retry
  }
}
```

### Contracts barrel addition (`packages/contracts/src/index.ts`)

```typescript
// existing
export * as AuthProto from './generated/auth';
// ...
// NEW (Phase 24)
export * as TelegramTypes from './external/telegram';
export * as AppStoreSpyTypes from './external/appstorespy';
export * as CloudFnTypes from './external/cloud-functions';
```

`packages/contracts/src/external/telegram/index.ts` re-exports from `./types.ts`. The `generate.sh` script only touches `src/generated/`, so adding `src/external/` is safe — Turbo `generate` task does not declare `src/external/**` as outputs and `tsc -p tsconfig.json` will pick them up via `include: ["src/**/*"]` (verified in `packages/contracts/tsconfig.json`).

## Technical Approach — per Decision

### D-01..D-04: Architecture
- Create `packages/foundation/src/external/http/` with files: `abstract-http-client.ts`, `http-client.constants.ts`, `http-client.types.ts`, `http-client.errors.ts`, `retry-policy.ts`, `index.ts`. Export from foundation external barrel (`packages/foundation/src/external/index.ts`) — add line `export * from './http';`.
- **No per-API code in foundation.** `Telegram*`/`AppStoreSpy*`/`CloudFn*` strings appear only in apps and contracts.
- Lesson from 999.7 explicitly avoided (D-04) — verify in plan-checker step that no `apps/*` or `packages/contracts/*` strings appear in foundation.

### D-05/D-06: Native fetch
- Use `globalThis.fetch` directly. No imports.
- For per-attempt timeout: `signal: AbortSignal.timeout(timeoutMs)` in `RequestInit`. On timeout, fetch throws `DOMException` with `name === 'TimeoutError'` (or, depending on Node version, `AbortError`) — see Pitfall 4.
- For HTTP 4xx/5xx: fetch does **not** throw; check `response.ok` (false for status 400-599). Wrap in `HttpError(status, url)`.
- For network errors (DNS failure, ECONNREFUSED, etc.): fetch throws `TypeError` with a `cause` property exposing the underlying undici error. Map to `NetworkError(cause)`.

### D-07/D-08/D-12: Circuit breaker
- One `opossum.CircuitBreaker` instance per `AbstractHttpClient` instance (= per adapter). Created in `onModuleInit`.
- Approximation strategy for "5 consecutive failures":
  - `errorThresholdPercentage: 100` — only opens at 100% errors
  - `volumeThreshold: 5` — minimum 5 calls in window before opening can occur
  - `rollingCountTimeout: 30_000` — 30s window
  - **Caveat:** if 4 fail then 1 succeeds within 30s, counter doesn't reset to require 5 more failures — opossum is window-based, not state-machine. This is acceptable for D-12 simplicity. **If exact "consecutive" semantics are required**, wrap the inner function with a counter that throws a `ConsecutiveThresholdError` after N consecutive failures, and let opossum trip on that single error (set `volumeThreshold: 1`, `errorThresholdPercentage: 100`). Recommended in Pitfall 3.
- `resetTimeout: 30_000` (D-12 — half-open after 30s).
- `timeout: false` — disable opossum's own per-call timeout because we already do per-attempt timeout via `AbortSignal.timeout`. opossum's timeout would race with retry loop and create false failures.
- Per-adapter override: `cbOptions` constructor argument — adapter modules can pass custom `consecutiveThreshold` / `halfOpenAfterMs`.

### D-09/D-10: Retry policy
- Idempotent set: `['GET', 'HEAD']`. Effective `maxAttempts`:
  - `IDEMPOTENT_METHODS.includes(method) || opts.idempotent === true` → `opts.retries ?? RETRY_MAX_ATTEMPTS` (3)
  - else → `1` (no retry)
- `shouldRetry(err, attempt, policy)`:
  - `attempt >= maxAttempts` → false
  - `err instanceof HttpError && err.status >= 500` → true
  - `err instanceof NetworkError` → true
  - `err instanceof TimeoutError` → true (treat as transient)
  - `err instanceof HttpError && 400 <= err.status < 500` → false (D-09)
  - else → false
- Backoff: equal jitter — `delay = base * 2^(attempt-1)` clamped to `[backoffMinMs, backoffMaxMs]`, then `actual = delay/2 + random(0, delay/2)`. Simple, well-known, sufficient for skeleton scope. `[CITED: AWS Architecture Blog "Exponential Backoff And Jitter" — "equal jitter"]`

### D-11: Timeout
- `signal: AbortSignal.timeout(opts.timeoutMs ?? defaultTimeoutMs)` per attempt.
- Per-adapter default via constructor arg.
- Per-call override via `CallOpts.timeoutMs`.

### D-13: Health
- **No new code.** External API health is not added to readiness. Document in PLAN.md as explicit non-task to prevent scope creep.

### D-14/D-15/D-16/D-17: Logging
- Per-call log (`HTTP_CLIENT_LOG.EVENT_CALL`):
  ```ts
  this.logger[level]({
    api: this.logContext, method, url,
    duration_ms: Date.now() - start, status_code: res?.status,
    status: 'OK' | 'ERROR', correlationId: this.cls.getId(),
  }, HTTP_CLIENT_LOG.EVENT_CALL);
  ```
- CB transition log (`HTTP_CLIENT_LOG.EVENT_CB_TRANSITION`):
  ```ts
  this.logger.warn({ api: this.logContext, transition: 'open' }, HTTP_CLIENT_LOG.EVENT_CB_TRANSITION);
  ```
- **Body never logged.** D-16. Only `status_code` and `url` (without query string sanitization for skeleton — flag as deferred if APIs put PII in query).
- `PinoLogger.root.child({ context })` in `onModuleInit` (Pitfall 6 of Phase 23 — verified by reading `correlation.interceptor.ts` and `abstract-grpc-client.ts`).

### D-18: Skeleton scope
- TelegramClient: 1 method `sendMessage({ chat_id, text }) → Message` (Telegram Bot API `POST /bot{token}/sendMessage`).
- AppStoreSpyClient: 1 method `getAppMetadata(appId) → AppMetadata` (vendor-specific endpoint).
- CloudFnClient: 1 method `sendEmail({ to, subject, body }) → SendResponse` (POST, no retry).
- Each adapter's `index.ts` barrel exports `*ClientModule` and the DI symbol token.

### D-19: Env
- Notifier env schema add: `TELEGRAM_BOT_TOKEN: z.string().min(1)`, `TELEGRAM_BASE_URL: z.string().url()`.
- Parser env schema add: `APPSTORESPY_API_KEY: z.string().min(1)`, `APPSTORESPY_BASE_URL: z.string().url()`.
- Sender env schema add: `CLOUDFN_API_KEY: z.string().min(1)`, `CLOUDFN_BASE_URL: z.string().url()`.
- **No defaults** in any of these (project rule). Add to `.env.example` and `.env.docker` with placeholder values + comment.
- Approach: create new sub-schema `packages/config/src/schemas/external-apis.ts` with three small schemas (`TelegramSchema`, `AppStoreSpySchema`, `CloudFnSchema`) and three matching types. Each consumer service composes only the one(s) it needs into its `*EnvSchema`. Mirrors Phase 20 pattern (verified in `packages/config/src/schemas/index.ts`).

### D-20: DI tokens
- All three adapter tokens via `Symbol.for('TELEGRAM_CLIENT')` etc. — Phase 23 precedent.

## Library Reference

### opossum 9.0.0
- Engines: `^24 || ^22 || ^20` — compatible with our Node 22.22 runtime. `[VERIFIED]`
- Constructor: `new CircuitBreaker(action: (...args) => Promise<T>, options?: CircuitBreakerOptions)` `[CITED: nodeshift.dev/opossum]`
- Key options used:
  - `errorThresholdPercentage` (default 50) — % of errors in window to trip
  - `volumeThreshold` (default 0) — min calls before tripping is allowed
  - `resetTimeout` (default 30000) — ms before half-open
  - `rollingCountTimeout` / `rollingCountBuckets` — window definition
  - `timeout` — per-call timeout (we set `false` to disable; we use AbortSignal instead)
  - `capacity` — concurrency limit (we leave default `MAX_SAFE_INTEGER`)
- Events used: `open`, `halfOpen`, `close` (D-17). Other available: `fire`, `success`, `failure`, `timeout`, `fallback`, `reject`, `semaphoreLocked`.
- `.fire(...args)` returns `Promise<T>`. When breaker is open, fires synchronously rejected promise with message containing `'Breaker is open'` — we catch and rewrap as `CircuitOpenError` (Pitfall 5 — relying on string matching is brittle, see below).
- **Gotcha — consecutive failures:** opossum is rolling-window percentage-based; "5 consecutive" is approximated, not exact (Pitfall 3).
- TypeScript types in separate package `@types/opossum@8.1.9`. Version skew with runtime is normal for DefinitelyTyped — verified imports work via standard `import CircuitBreaker from 'opossum'`.

### Native fetch (Node ≥ 21 stable)
- `fetch(url, init?: RequestInit): Promise<Response>` — global. `[CITED: https://nodejs.org/api/globals.html#fetch]`
- Does NOT throw on 4xx/5xx — check `response.ok`. `[VERIFIED via official Node docs]`
- On timeout via `AbortSignal.timeout(ms)`: throws `DOMException` with `name === 'TimeoutError'`. On manual abort: `name === 'AbortError'`. **Detect both.** `[ASSUMED — based on WHATWG abort spec; verify in Wave 0 with smoke test that triggers both paths]`
- On network error (DNS, ECONNREFUSED): throws `TypeError` with `.cause` pointing to undici error (e.g. `{ code: 'ECONNREFUSED' }`). Pattern: `if (err instanceof TypeError) → NetworkError(err.cause)`. `[ASSUMED — undici is the Node fetch backend; widely documented but not in our local docs read; verify in Wave 0]`
- `Response.json()` returns `Promise<unknown>` — caller is responsible for type assertion (we cast in `request<T>`).

### AbortSignal.timeout
- Static method. Signal aborts after `ms`. Composable with `AbortSignal.any([sig1, sig2])` if we need user-cancellation later. `[VERIFIED locally]`

### undici (not directly imported)
- `8.1.0` requires Node ≥ 22.19. Our root engines say `>=20`; runtime is 22.22. **If we add `undici` as direct dep**, it would force engine bump. **Recommendation: do not add undici to package.json for Phase 24** — we use native fetch (which uses bundled undici internally). Defer explicit undici import to a future tuning phase if connection pooling is needed.

## Migration Risks

### Risk 1: notifier's existing TelegramNotificationSender stub
- **Current:** `apps/notifier/src/infrastructure/external/telegram-notification.sender.ts` — `NotImplementedException` stub implementing `NotificationSenderPort`.
- **Used by:** `apps/notifier/src/notifier.module.ts` — `{ provide: NOTIFICATION_SENDER_PORT, useClass: TelegramNotificationSender }`.
- **Migration path:**
  1. Create new `apps/notifier/src/infrastructure/clients/telegram/{telegram.client.ts, telegram.module.ts, telegram.constants.ts, index.ts}`. `TelegramClient` is the HTTP-skeleton client (1 method, returns parsed response).
  2. Update `TelegramNotificationSender` to inject `TelegramClient` and translate `Notification` → `SendMessageRequest`. Or rename file/class to `TelegramNotificationAdapter` and move into `clients/telegram/`. Either is fine — the **port stays** (`NotificationSenderPort`), but the implementation now uses the new HTTP framework.
  3. Update `notifier.module.ts` imports to add `TelegramClientModule.forRoot()`.
  4. Delete `apps/notifier/src/infrastructure/external/` directory if `telegram-notification.sender.ts` was its only resident (verified — `ls` showed no other files).
- **Risk:** existing tests/smoke that touch `NotImplementedException` path will now make real calls. **Mitigation:** ensure `TELEGRAM_BOT_TOKEN` is set in `.env*` before merge; otherwise app fails to boot due to Zod validation (good — fail-fast).

### Risk 2: contracts package src/external alongside src/generated
- `tsconfig.json` has `include: ["src/**/*"]` — accepts `src/external/`. `[VERIFIED]`
- `generate.sh` only writes to `src/generated/` and does `rm -rf` only on that dir — `src/external/` is safe. `[VERIFIED]`
- Turbo `generate` task `outputs: ["src/generated/**"]` — does not blow away `src/external/`. `[VERIFIED]`
- `package.json` `files: ["dist", "proto"]` — `src/external` will be compiled into `dist/external` and shipped. `[VERIFIED]`
- **No risk** to existing build pipeline. Adding `src/external/` is purely additive.

### Risk 3: cross-service env schema rebuild
- Three different services need three new env vars each. Phase 20 sub-schema pattern means each per-service schema file gets one new compose entry — no monolithic schema touched. `[VERIFIED via `packages/config/src/schemas/index.ts` and `notifier-env.schema.ts`]`
- Risk: missing `.env*` updates. **Mitigation:** task in plan to update both `.env.example` and `.env.docker` atomically with each schema change.

### Risk 4: opossum string-match for "Breaker is open"
- We catch the rejection from `breaker.fire()` and check `err.message.includes('Breaker is open')`. opossum may change this string. **Mitigation:** check `breaker.opened === true` after the failure instead, or check `err.code === 'EOPENBREAKER'` if opossum uses an error code. **Verify in Wave 0 by triggering CB open and inspecting actual error shape.** `[ASSUMED — confirm against opossum 9.0.0 actual error API]`

### Risk 5: Telegram/AppStoreSpy/CloudFn API specifics unknown at planning time
- Phase 24 D-18 is "skeleton" — types and 1 method are fine even if vendor signatures need adjusting later. **Recommend** that the planner mark skeleton method signatures as "to-be-refined when business logic phase starts" rather than burning research budget on full vendor doc reads now.

## Validation Architecture

**Test Framework**
| Property | Value |
|----------|-------|
| Framework | `pnpm build` (tsc) + `pnpm lint` + manual smoke. No Jest yet (project charter "Testing — отдельный следующий этап"). |
| Config file | `tsconfig.base.json` + per-package `tsconfig.json` |
| Quick run command | `pnpm build` (Turbo affected-only) |
| Full suite command | `pnpm build && pnpm lint` workspace-wide |
| Phase gate | full build + lint green; manual smoke: TelegramClient sends a real test message (with valid TELEGRAM_BOT_TOKEN); a forced-failure smoke (point base URL at unreachable host) opens CB after 5 failures and emits `http.client.circuit.open` log line |

**Phase Requirements → Test Map**

| Req ID | Behavior | Test Type | Observable Signal | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HTTP-01 | Framework exists, retry+timeout+logging compile | typecheck | `pnpm build` green; `apps/notifier/src/infrastructure/clients/telegram/telegram.client.ts` extends `AbstractHttpClient` from `@email-platform/foundation` with no `any` casts | ❌ Wave 0 (file does not exist yet) |
| HTTP-01 | Default timeout enforced | runtime | Smoke endpoint with `defaultTimeoutMs: 100` against `http://10.255.255.1` (blackhole) — fails with `TimeoutError` within ~150ms | ❌ Wave 0 (smoke path) |
| HTTP-01 | Per-call timeout override | runtime | `client.get('/x', { timeoutMs: 50 })` overrides default | ❌ optional |
| HTTP-01 | Logs include all 6 fields | log inspection | `docker logs notifier` after one call → JSON line with `api`, `method`, `url`, `duration_ms`, `status_code`, `correlationId` keys present | runtime only |
| HTTP-02 | CB opens after N failures | runtime | Force 5 consecutive failures → 6th call rejects synchronously with `CircuitOpenError` (or breaker.fire rejects without invoking inner fn) | ❌ Wave 0 |
| HTTP-02 | CB transitions logged | log inspection | After CB opens: log line `http.client.circuit` with `transition: 'open'`. After 30s: `transition: 'halfOpen'`. After successful call: `transition: 'close'` | runtime |
| HTTP-03 | Three adapters exist | audit | `find apps -path '*/clients/*/{telegram,appstorespy,cloud-functions}.client.ts'` returns 3 files | ❌ Wave 0 |
| HTTP-03 | Each consumer module imports only its adapter | audit | `apps/notifier/src/notifier.module.ts` imports `TelegramClientModule` only; `apps/parser/.../parser.module.ts` imports `AppStoreSpyClientModule` only; `apps/sender` imports `CloudFnClientModule` only | ❌ Wave 0 |
| HTTP-04 | CB not applied to gRPC | audit | `grep -r "opossum" packages/foundation/src/external/grpc` returns zero hits; `grep -r "CircuitBreaker" packages/foundation/src/external/grpc` returns zero hits | automated |
| D-09 | 4xx not retried | runtime | Force 401 response → exactly 1 attempt logged | ❌ Wave 0 |
| D-09 | 5xx retried 3 times | runtime | Force persistent 500 → 3 attempts logged with exponential delays | ❌ Wave 0 |
| D-10 | POST not retried by default | runtime | Force 500 on POST → exactly 1 attempt | ❌ Wave 0 |
| D-10 | POST with idempotent: true retries | runtime | `client.post('/x', body, { idempotent: true })` against 500 → 3 attempts | ❌ Wave 0 |
| D-13 | External APIs not in /health/ready | audit | `grep -r "TELEGRAM\|APPSTORESPY\|CLOUDFN" apps/*/src/health/` returns zero hits | automated |
| D-16 | Body not logged | log inspection | After call with body, log line for `http.client.call` does not contain any string from body | runtime, manual visual |
| D-19 | No Zod defaults | audit | `grep -r "\.default(" packages/config/src/schemas/external-apis.ts` returns zero hits | automated |
| D-20 | Symbol.for() everywhere | audit | `grep -r "Symbol(" apps/*/src/infrastructure/clients/` returns zero hits (only `Symbol.for` allowed) | automated |

**Sampling Rate**
- Per task commit: `pnpm build` (per-package affected via Turbo)
- Per wave merge: `pnpm build && pnpm lint` workspace-wide
- Phase gate: full build + lint + manual smoke matrix (Telegram real send + forced-failure CB open + log inspection)

**Wave 0 Gaps**
- [ ] Decide and document the skeleton smoke endpoint location (likely `apps/notifier/src/test/telegram-smoke.controller.ts`, `apps/parser/src/test/appstorespy-smoke.controller.ts`, `apps/sender/src/test/cloudfn-smoke.controller.ts`) — pattern from Phase 22.3 storage smoke controllers
- [ ] `.env.example` + `.env.docker` placeholders for 6 new env vars
- [ ] No Jest install — project charter explicitly defers tests

## Common Pitfalls

### Pitfall 1: opossum's `timeout` racing our retry loop
**What goes wrong:** If `opossum.options.timeout` is set to a non-false value, it imposes a per-`fire()`-call timeout that includes our entire retry loop. A 5s default would kill the second retry attempt.
**Why it happens:** opossum's timeout was designed for non-retrying use. Wrapping a retry loop with opossum requires disabling its timeout.
**How to avoid:** Always set `timeout: false` in CircuitBreaker options. We already do per-attempt timeout via `AbortSignal.timeout(ms)`.
**Warning signs:** First attempt succeeds fast, but on slow networks the breaker fires `'timeout'` event mid-retry-loop.

### Pitfall 2: PinoLogger context inference (carried over from Phase 23 Pitfall 6)
**What goes wrong:** Injecting `PinoLogger` and calling `setContext()` mutates the shared singleton; the last-initialized adapter overwrites all other contexts. With three adapters, this is guaranteed to misbehave.
**How to avoid:** Inject `ClsService` only. Create per-instance child logger via `PinoLogger.root.child({ context: this.logContext })` inside `onModuleInit` (NOT constructor — `PinoLogger.root` is undefined until LoggerModule has initialized). Mirror `abstract-grpc-client.ts:30-35` exactly.
**Warning signs:** All three adapters log with identical `context` field (last-loaded wins).

### Pitfall 3: opossum is rolling-window percentage-based, not consecutive-failure-based
**What goes wrong:** D-12 says "open after 5 consecutive failures." opossum doesn't have a consecutive-counter mode; it tracks error percentage over a rolling time window.
**Why it happens:** opossum is modeled after Hystrix (Netflix), which uses statistical thresholds.
**How to avoid (two options):**
- **Option A (approximation):** `errorThresholdPercentage: 100` + `volumeThreshold: 5` + `rollingCountTimeout: 30_000`. Opens after 5 errors with 100% error rate in 30s window. **Approximate but acceptable** for D-12 spirit on low-traffic external APIs (Telegram bot webhook is rarely > 1 RPS). False-positives possible if an old error in the window combines with new ones to hit 5 total.
- **Option B (exact):** wrap inner fn with a counter that throws a sentinel `ConsecutiveThresholdError` after N consecutive failures, set `volumeThreshold: 1` + `errorThresholdPercentage: 100`. This makes opossum trip on a single sentinel error. Simpler semantics, ~15 LOC. **Recommended for clarity** — preserves D-12 verbatim.
**Warning signs:** Smoke test with mixed pass/fail pattern shows CB opening at unexpected counts.

### Pitfall 4: AbortSignal.timeout error type varies across Node versions
**What goes wrong:** On Node 22, `AbortSignal.timeout(ms)` causes fetch to reject with `DOMException` whose `name === 'TimeoutError'`. On Node 18.x and some 20.x patches, the name was `'AbortError'`. Our `shouldRetry()` and error normalization must handle both.
**How to avoid:** In `normalizeError(err)`, check `err.name === 'TimeoutError' || err.name === 'AbortError'` → `TimeoutError`. Document that we treat both as timeout.
**Warning signs:** Timeouts not retrying (because we matched only one name) → `HttpError` propagating instead of retry.

### Pitfall 5: Detecting "circuit open" from opossum's reject error
**What goes wrong:** When the breaker is open, `breaker.fire()` rejects synchronously without calling the action. The rejection carries an Error whose `.message` (in opossum 9.x) starts with `'Breaker is open'`. Future versions may change this string.
**How to avoid:** Prefer checking `breaker.opened === true` after the rejection, or use an event listener that captures the reject and re-throws our own `CircuitOpenError` from inside the breaker (`breaker.on('reject', ...)` fires when the circuit blocks). **Recommended pattern:** wrap `.fire()` and check `breaker.status.stats.state` or the `breaker.opened` boolean rather than parse the message.
**Warning signs:** Opossum upgrade silently breaks our error categorization; consumers see generic `Error` instead of `CircuitOpenError`.

### Pitfall 6: `fetch` does not throw on 4xx/5xx
**What goes wrong:** `await fetch(url)` resolves successfully even for HTTP 500. Without an explicit `if (!res.ok)` check, we'd never trigger retry on 5xx and never count failures for CB.
**How to avoid:** Always `if (!res.ok) throw new HttpError(res.status, url)` after fetch resolves. Distinguish 4xx vs 5xx in `shouldRetry`.
**Warning signs:** Logs show `status_code: 503`, `status: 'OK'` (because we never threw).

### Pitfall 7: Network-error type detection
**What goes wrong:** Native fetch throws `TypeError` on network errors (DNS failure, ECONNREFUSED). Our retry must recognize this — but `TypeError` is too broad to catch blindly (might mask programmer errors like passing wrong arg type).
**How to avoid:** Match on `err instanceof TypeError && err.cause` — fetch's network errors always have a `cause`. Programmer-type-errors do not. Then map `cause.code` (`ECONNREFUSED`, `ENOTFOUND`, etc.) → `NetworkError`.
**Warning signs:** Programmer error masquerading as transient network failure → infinite retry.

### Pitfall 8: Jitter formula bias
**What goes wrong:** Naive `Math.random() * delay` can synchronize retries across replicas (thundering herd). Decorrelated jitter (`min + random(prevDelay * 3)`) is industry-standard but more complex.
**How to avoid:** Equal jitter (`delay/2 + random(0, delay/2)`) is the AWS recommendation — simple, well-distributed, unsynchronized. Use it. Document choice in code comment.
**Warning signs:** When the failing endpoint recovers, all clients hit it simultaneously and overwhelm it again.

### Pitfall 9: CB transition log noise on flapping
**What goes wrong:** A flapping endpoint causes rapid open↔halfOpen↔close transitions, spamming logs. Each transition is logged at `info`/`warn` level.
**How to avoid:** Log open/halfOpen at `warn`, close at `info`. Add a `lastTransitionAt` field and skip duplicate logs within < 1s. Defer this de-duping to v5 (OTEL) — for Phase 24 skeleton, allow noise.
**Warning signs:** Log volume spikes when an external API has intermittent failures.

### Pitfall 10: Forgetting to add `external-apis.ts` schema export to `packages/config/src/schemas/index.ts`
**What goes wrong:** New sub-schemas not re-exported → compose call references undefined → runtime crash on boot.
**How to avoid:** When adding `external-apis.ts`, append exports to `packages/config/src/schemas/index.ts` in the same commit. Mirror Phase 20 pattern.
**Warning signs:** `Cannot find name 'TelegramSchema'` at compile, or `undefined is not a function` from composeSchemas at runtime.

## Open Questions (RESOLVED)

### Q1: opossum consecutive-failure approximation vs exact wrapper?
- **What we know:** opossum is rolling-window percentage-based. D-12 says "5 consecutive."
- **What's unclear:** how strictly D-12 must be honored. CONTEXT.md says "не error percentage — для простоты на старте."
- **RESOLVED:** Implement Option B (small wrapper layer with consecutive counter that throws sentinel error after N failures, opossum trips on the sentinel). Costs ~15 LOC, preserves D-12 verbatim, removes ambiguity. Document option A as fallback if wrapper ever proves problematic.

### Q2: Retry layer inside or outside CB?
- **What we know:** Either ordering is defensible. Inside (CB wraps retry) means retries don't count as separate CB calls. Outside (retry wraps CB) means each attempt is a separate CB call → CB trips faster.
- **RESOLVED:** Retry **inside** CB (CB wraps the retry loop). Reason: CB measures *user-visible* failures; transient retried-and-recovered errors should not count toward opening. This matches Hystrix and most production guides.

### Q3: Per-service env sub-schema or inline in service env?
- **What we know:** Phase 20 established per-concern shared sub-schemas in `packages/config/src/schemas/`.
- **RESOLVED:** Create `packages/config/src/schemas/external-apis.ts` with three exported schemas (`TelegramSchema`, `AppStoreSpySchema`, `CloudFnSchema`). Each consumer composes only the one it needs into its env file. Symmetric with how `RedisSchema` etc. are handled.

### Q4: Where do contracts/external/{api}/types.ts barrel-export?
- **RESOLVED:** Each `packages/contracts/src/external/{api}/index.ts` re-exports from `./types.ts`. Top-level `packages/contracts/src/index.ts` adds three lines: `export * as TelegramTypes from './external/telegram'` etc. Symmetric with current `export * as AuthProto from './generated/auth'`.

### Q5: Should `AbstractHttpClient` be exported from foundation barrel or kept private?
- **What we know:** `AbstractGrpcClient` is **NOT** exported from `packages/foundation/src/external/index.ts` (consumers extend the per-service concrete classes that live in foundation today; after 999.7 they will live in apps and import the abstract).
- **RESOLVED:** Phase 24 lives in apps from day one (D-03). Therefore `AbstractHttpClient` MUST be exported from foundation barrel so app-level adapters can `extends AbstractHttpClient`. Add to `external/http/index.ts` and append `export * from './http'` to `external/index.ts`.

### Q6: TelegramNotificationSender — keep file at old path or move?
- **What we know:** Old file is a stub; only consumer is `notifier.module.ts`.
- **RESOLVED:** Move and rename — new file `apps/notifier/src/infrastructure/clients/telegram/telegram-notification.adapter.ts` implements `NotificationSenderPort` by injecting `TelegramClient` and translating domain `Notification` → `SendMessageRequest`. Delete `apps/notifier/src/infrastructure/external/` directory afterward (it had only this one file).

### Q7: Should each adapter accept its own `cbOptions` override or use foundation defaults?
- **RESOLVED:** Constructor accepts `cbOptions` and `defaultRetryPolicy`; modules pass foundation defaults from `HTTP_CLIENT_DEFAULTS`. If a future adapter needs different thresholds (e.g. CloudFn 10s timeout vs 5s default), override at module-factory level. No env vars for adapter-specific tuning in Phase 24 — defer to when a real need appears.

### Q8: Do we need `undici` as a direct dep?
- **RESOLVED:** **No.** Native fetch (which uses undici internally) is sufficient for skeleton scope. Adding `undici@8` would force engines bump to >=22.19. Defer connection-pool tuning to a future phase if measurable benefit appears.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Native fetch on Node 22 throws `DOMException` named `TimeoutError` for `AbortSignal.timeout` and `AbortError` for manual abort | Pitfall 4, Library Reference | If actual name differs, our `shouldRetry`/`normalizeError` won't recognize timeout → falls through to generic Error → not retried. **Mitigation:** Wave 0 smoke test with `AbortSignal.timeout(1)` to log actual `err.name`. |
| A2 | Native fetch throws `TypeError` with `.cause` for network errors (ECONNREFUSED, ENOTFOUND) | Pitfall 7, Library Reference | If `cause` is missing on certain Node/undici combinations, our network-error categorization fails. **Mitigation:** Wave 0 smoke against a blackhole IP to verify error shape. |
| A3 | opossum 9.0.0 reject message includes `'Breaker is open'` | Pitfall 5 | String match breaks silently. **Mitigation:** prefer `breaker.opened` boolean check or `breaker.on('reject', ...)` — refactor in plan. |
| A4 | `AbortSignal.timeout` causes the timeout to propagate as a fetch rejection (not silent) on Node 22 | D-11 | Verified locally `typeof AbortSignal.timeout === 'function'`; behavior assumed standard per WHATWG. |
| A5 | CONTEXT.md D-12 "5 consecutive" can be approximated via percentage thresholds OR via wrapper layer | Pitfall 3, Q1 | If exact semantics demanded, wrapper layer is mandatory. **Recommendation:** wrapper layer (Option B) — already chose it. |
| A6 | Telegram Bot API base URL pattern `https://api.telegram.org/bot{TOKEN}` is current as of 2026-04 | D-19 skeleton | If vendor URL changed, env override fixes it without code change. **Low risk** — Telegram API URL has been stable since 2015. |
| A7 | AppStoreSpy has a documented HTTP API with bearer-token auth | D-18 | If API surface differs, skeleton method signature is wrong. **Low risk** — D-18 explicitly says skeleton-only; signatures will be adjusted in business-logic phase. |
| A8 | Cloud Functions endpoint is HTTP POST with API key — vendor specifics not investigated this phase | D-18 | Same as A7. |

## Sources

### Primary (HIGH confidence — verified in repo or local execution)
- `packages/foundation/src/external/grpc/clients/abstract-grpc-client.ts` — Phase 23 mirror pattern
- `packages/foundation/src/external/grpc/clients/grpc-client-logging.types.ts` — log fields shape
- `packages/foundation/src/external/cache/cache.providers.ts` — DynamicModule + Symbol DI factory pattern
- `packages/foundation/src/external/logging/correlation.interceptor.ts` — `PinoLogger.root.child` precedent
- `packages/contracts/scripts/generate.sh` + `packages/contracts/tsconfig.json` — verified `src/external/` is safe to add
- `apps/notifier/src/infrastructure/external/telegram-notification.sender.ts` — current stub state
- `apps/notifier/src/infrastructure/config/notifier-env.schema.ts` — Phase 20 sub-schema pattern
- `npm view opossum version` → 9.0.0 (verified locally)
- `npm view opossum engines` → `^24 || ^22 || ^20`
- `npm view @types/opossum version` → 8.1.9
- `node --version` → v22.22.0; `typeof fetch === 'function'` → true; `typeof AbortSignal.timeout === 'function'` → true

### Secondary (MEDIUM/HIGH — official docs)
- [Node.js fetch global](https://nodejs.org/api/globals.html#fetch) — verified stability + response.ok pattern
- [opossum docs (NodeShift)](https://nodeshift.dev/opossum/) — constructor, options, events
- [AWS Architecture Blog — Exponential Backoff And Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/) — equal-jitter formula
- [gRPC deadlines docs](https://grpc.io/docs/guides/deadlines/) — confirms gRPC and HTTP timeout semantics differ (HTTP-04 isolation)

### Tertiary (LOW — needs Wave 0 verification)
- Exact `err.name` for fetch timeout/abort on Node 22 (A1)
- Exact opossum 9.0.0 reject error shape (A3)
- AppStoreSpy / CloudFn API surfaces (A7, A8)

## Metadata

**Confidence breakdown:**
- Standard stack (opossum + native fetch): HIGH — version + engines + behavior verified
- Architecture pattern (mirror of Phase 23): HIGH — direct file read of `abstract-grpc-client.ts`
- Per-service adapter scaffold: HIGH — direct mirror of `notifier-client.module.ts`
- Contracts package extension: HIGH — verified `tsconfig`, `generate.sh`, Turbo task all safe
- D-12 consecutive-failure mapping: MEDIUM — opossum is window-based; recommended Option B is straightforward but adds code
- Vendor API specifics (Telegram/AppStoreSpy/CloudFn): LOW — D-18 explicitly skeleton; signatures will need adjustment in business phase

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (30 days — opossum and Node fetch are stable)
