---
phase: 24-http-client-circuit-breaker
plan: 01
subsystem: foundation/external/http
tags: [foundation, http-client, circuit-breaker, opossum, retry, resilience]
requires: [Phase 23 AbstractGrpcClient pattern, LoggingModule (PinoLogger.root)]
provides:
  - AbstractHttpClient base class (public, via foundation barrel)
  - HTTP_CLIENT_LOG / HTTP_CLIENT_DEFAULTS / HTTP_CLIENT_IDEMPOTENT_METHODS
  - HttpCallOpts / CbOptions / HttpClientLogFields / CircuitTransitionLogFields / HttpMethod / RetryPolicy
  - HttpError / TimeoutError / NetworkError / CircuitOpenError / ConsecutiveThresholdError
affects: [packages/foundation barrel, packages/foundation package.json]
tech-stack:
  added: [opossum@^9.0.0 (runtime, foundation only), @types/opossum@^8.1.9 (dev)]
  patterns:
    - "Option B consecutive-counter CB wrapper (throws ConsecutiveThresholdError sentinel, opossum opens on volumeThreshold:1 + errorThresholdPercentage:100)"
    - "opossum timeout:false MANDATORY — per-attempt timeout lives in AbortSignal.timeout inside retry loop"
    - "PinoLogger.root.child({ context }) deferred to onModuleInit (mirrors Phase 23 Pitfall 6 fix)"
    - "AWS equal-jitter backoff on 5xx/network/timeout"
    - "Idempotency gate: GET/HEAD retried, POST/PUT/PATCH/DELETE single-shot unless opts.idempotent=true"
key-files:
  created:
    - packages/foundation/src/external/http/http-client.constants.ts
    - packages/foundation/src/external/http/http-client.types.ts
    - packages/foundation/src/external/http/http-errors.ts
    - packages/foundation/src/external/http/retry.policy.ts
    - packages/foundation/src/external/http/circuit-breaker.factory.ts
    - packages/foundation/src/external/http/abstract-http.client.ts
    - packages/foundation/src/external/http/index.ts
  modified:
    - packages/foundation/package.json
    - packages/foundation/src/external/index.ts
    - pnpm-lock.yaml
decisions:
  - "HttpCallOpts renamed from CallOpts to avoid collision with gRPC CallOpts already re-exported from foundation barrel (Rule 3 — blocking issue)"
metrics:
  duration: ~6min
  completed_date: 2026-04-15
  tasks: 2
  files_created: 7
  files_modified: 3
  total_lines: 536
  commits: 2
---

# Phase 24 Plan 01: HTTP Client Foundation Primitives — Summary

One-liner: Ship generic AbstractHttpClient (fetch + AbortSignal.timeout + equal-jitter retry + opossum circuit breaker via Option B consecutive-failure wrapper) in `packages/foundation/src/external/http/` with zero per-API knowledge, exported via foundation barrel.

## Files Created (7, 536 total LOC)

| File | LOC | Purpose |
|------|-----|---------|
| `http-client.constants.ts` | 50 | `HTTP_CLIENT_LOG`, `HTTP_CLIENT_DEFAULTS`, `HTTP_CLIENT_IDEMPOTENT_METHODS`, `HTTP_CLIENT_RETRYABLE_STATUS_MIN`, `HTTP_CLIENT_TIMEOUT_ERR_NAMES`, `HTTP_CLIENT_CB_BREAKER_OPEN_MESSAGE_SUBSTRING` — all `as const`, zero magic values |
| `http-client.types.ts` | 48 | `HttpMethod`, `HttpCallOpts`, `RetryPolicy`, `CbOptions`, `HttpClientLogFields`, `CircuitTransitionLogFields` |
| `http-errors.ts` | 51 | `HttpError`, `TimeoutError`, `NetworkError`, `CircuitOpenError`, `ConsecutiveThresholdError` |
| `retry.policy.ts` | 86 | `resolveRetryPolicy` (idempotency gate), `shouldRetry` (4-branch classifier), `backoffWithJitter` (AWS equal-jitter), `normalizeError` (TimeoutError/AbortError → canonical TimeoutError, TypeError with cause → NetworkError), `sleep` |
| `circuit-breaker.factory.ts` | 62 | `createCircuitBreaker()` — Option B wrapper + opossum with `timeout:false` mandated |
| `abstract-http.client.ts` | 210 | `AbstractHttpClient` base class, onModuleInit lifecycle, get/post/put/patch/delete wrappers, structured 6-field log emission, CB transition log |
| `index.ts` | 29 | Public barrel — re-exports only consumer-facing symbols (internal helpers NOT exported) |

## opossum Installation

```
packages/foundation/package.json:
  dependencies:    "opossum": "^9.0.0"
  devDependencies: "@types/opossum": "^8.1.9"

Root package.json:   unchanged (opossum isolated to foundation — D-01)
apps/*/package.json: unchanged
```

Engines compatibility: opossum 9.x supports Node >= 18 (project uses Node 20).

## HTTP-04 Isolation Proof

```bash
$ grep -rn "opossum" packages/foundation/src/external/grpc/
(no output — clean)

$ grep -rn "CircuitBreaker" packages/foundation/src/external/grpc/
(no output — clean)

$ grep -E '"opossum"' package.json apps/*/package.json
(no output — clean)
```

Circuit breaker lives only under `external/http/`. Zero cross-pollination into gRPC subsystem.

## 6 Pitfalls Verification

| # | Pitfall | Mitigation | Evidence |
|---|---------|------------|----------|
| 1 | opossum per-fire timeout races retry loop | `timeout: false` in `createCircuitBreaker` opts | `grep "timeout: false" circuit-breaker.factory.ts` → 1 hit (+ 2 in comment) |
| 2 | PinoLogger singleton setContext mutation | `PinoLogger.root.child({ context })` in `onModuleInit`; no `setContext()` call | `grep "PinoLogger.root.child"` → 2 hits; `grep "setContext("` → 0 code hits (only doc comment) |
| 3 | Consecutive-failure counter | Option B wrapper throws `ConsecutiveThresholdError`; opossum `volumeThreshold:1` + `errorThresholdPercentage:100` | `ConsecutiveThresholdError` referenced in factory + errors + constants + barrel |
| 4 | Timeout error name varies (`TimeoutError` / `AbortError`) | Both normalised to our `TimeoutError` via `HTTP_CLIENT_TIMEOUT_ERR_NAMES` | `['TimeoutError', 'AbortError']` in constants |
| 5 | CB open detection via message substring is fragile | `breaker.opened` boolean primary; substring fallback only | `breaker.opened ||` first clause in `request<T>` catch |
| 6 | fetch does NOT throw on 4xx/5xx | Explicit `if (!res.ok) throw new HttpError(res.status, url)` | 2 hits in abstract-http.client.ts |

## Decisions Realised

| Decision | Realisation |
|----------|-------------|
| D-01 foundation-only opossum | opossum added to `packages/foundation/package.json` only |
| D-05 native fetch | `AbstractHttpClient.executeAttempt` uses global `fetch` — no axios/got/@nestjs/axios |
| D-07 retry wraps fetch, CB wraps retry | `breaker.fire → executeWithRetry → executeAttempt` composition |
| D-09 3 attempts, 5xx retry, 4xx never | `RETRY_MAX_ATTEMPTS: 3`; `shouldRetry` returns true only for `HttpError.status >= 500`, `NetworkError`, `TimeoutError` |
| D-10 idempotency gate | `resolveRetryPolicy` returns `maxAttempts: 1` unless GET/HEAD or `opts.idempotent === true` |
| D-11 5s per-attempt timeout | `TIMEOUT_MS: 5_000` default, overridable via `opts.timeoutMs`, applied via `AbortSignal.timeout` |
| D-12 CB open after 5 consecutive, half-open after 30s | `CB_CONSECUTIVE_THRESHOLD: 5`, `CB_HALF_OPEN_AFTER_MS: 30_000` |
| D-14 opossum wrapper strategy | Option B (consecutive-counter wrapper with sentinel) |
| D-15 structured log on every call | `emitCallLog` with 6 fields + event name `http.client.call` |
| D-16 body never logged | `HttpClientLogFields` excludes body/headers; only `url` + `status_code` |
| D-17 CB transitions as separate event | `http.client.circuit` with `transition` field |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Rename `CallOpts` → `HttpCallOpts` to avoid barrel collision**
- **Found during:** Task 2 (first workspace build attempt)
- **Issue:** `external/grpc/clients/index.ts` re-exports `CallOpts` (gRPC-flavoured, has `deadlineMs`). Plan specified the same name for HTTP types, producing `TS2308: Module './grpc/clients' has already exported a member named 'CallOpts'` when `external/index.ts` added `export * from './http'`.
- **Fix:** Rename HTTP type to `HttpCallOpts` everywhere in the new `external/http/` layer (constants doc, types, retry.policy, abstract-http.client, barrel). No gRPC code touched.
- **Files modified:** all 6 new HTTP `.ts` files (already being authored — single-batch rename, no extra commits).
- **Commit:** `28fe35d`
- Plan frontmatter `artifacts[http-client.types].exports` listed `CallOpts`; the barrel now exports `HttpCallOpts` instead. Consumer-facing — worth flagging in Plan 24-02/24-03 planner input.

**2. [Rule 3 - Blocking] Headers merge typing**
- **Found during:** Task 2 build
- **Issue:** `{ Authorization?: undefined }` branch is not assignable to `HeadersInit`. The conditional `authHeader ? { Authorization } : {}` narrowed the type such that TS rejected the spread.
- **Fix:** Extracted merged headers into a `Record<string, string>` intermediate variable before constructing the `RequestInit`; cast `init.headers` through `Record<string, string> | undefined` for the spread.
- **Commit:** `28fe35d`

### Auth Gates

None.

## Commits

| # | Hash | Scope | Summary |
|---|------|-------|---------|
| 1 | `ae3441b` | Task 1 | opossum dep + HTTP constants, types, errors |
| 2 | `28fe35d` | Task 2 | AbstractHttpClient + retry policy + CB factory + barrel wiring |

## Verification Results

```
pnpm --filter @email-platform/foundation build: exit 0
pnpm build (workspace 10/10):                   exit 0  (Time: ~4s)
pnpm --filter @email-platform/foundation lint:  exit 0  (auto-format only)
grep opossum in external/grpc:                  0 hits
grep opossum in root + apps package.json:       0 hits
grep axios|got|@nestjs/axios in external/http:  0 hits
export * from './http' in external/index.ts:    present
timeout: false in circuit-breaker.factory.ts:   present
PinoLogger.root.child in abstract-http.client:  present (onModuleInit)
setContext( call in abstract-http.client:       0 (doc-comment reference only)
!res.ok explicit throw:                         present
TimeoutError + AbortError normalised:           both in HTTP_CLIENT_TIMEOUT_ERR_NAMES
ConsecutiveThresholdError sentinel:             thrown in circuit-breaker.factory.ts
```

## Known Stubs

None. AbstractHttpClient is a consumer base class — concrete adapters (AppStoreSpyClient, CloudFnClient, TelegramClient) are Plan 24-03 scope.

## Threat Flags

None. No new trust boundaries introduced beyond the threat model already declared in `24-01-PLAN.md`.

## Self-Check: PASSED

- packages/foundation/src/external/http/http-client.constants.ts: FOUND
- packages/foundation/src/external/http/http-client.types.ts: FOUND
- packages/foundation/src/external/http/http-errors.ts: FOUND
- packages/foundation/src/external/http/retry.policy.ts: FOUND
- packages/foundation/src/external/http/circuit-breaker.factory.ts: FOUND
- packages/foundation/src/external/http/abstract-http.client.ts: FOUND
- packages/foundation/src/external/http/index.ts: FOUND
- Commit ae3441b: FOUND
- Commit 28fe35d: FOUND
