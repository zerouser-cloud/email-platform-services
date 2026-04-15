---
phase: 23
plan: 02
subsystem: foundation/grpc-clients
tags: [grpc, client, facade, deadline, health, logging, pitfall-6]
requires:
  - 23-01 (diToken as Symbol, GrpcClientModule removed)
provides:
  - AbstractGrpcClient<TRaw> base (Promise facade over ts-proto Observable)
  - Per-call deadline via grpc-timeout Metadata header
  - Client-side Pino log 'grpc.client.call' with correlationId
  - GrpcClientHealthIndicator via grpc.health.v1.Health/Check
affects:
  - Plan 23-03 (5 per-service client modules consume these primitives)
  - Plan 23-04 (gateway verification uses two instances to prove Pitfall 6 fix)
tech-stack:
  added: []
  patterns:
    - PinoLogger.root.child({ context }) — per-instance child logger (NOT setContext)
    - getService<TRaw>() in onModuleInit (NOT constructor)
    - lastValueFrom for unary gRPC calls
    - HealthIndicatorService.check(key).up()/down() — terminus v11
key-files:
  created:
    - packages/foundation/src/external/grpc/clients/clients.constants.ts
    - packages/foundation/src/external/grpc/clients/grpc-client-logging.types.ts
    - packages/foundation/src/external/grpc/clients/abstract-grpc-client.ts
    - packages/foundation/src/external/grpc/clients/grpc-client-health.indicator.ts
  modified: []
decisions:
  - "Deadline interceptor (resilience/grpc-deadline.interceptor.ts) left unchanged — per-call deadline layered on top via Metadata header (plan body overrides stale frontmatter)"
  - "AbstractGrpcClient NOT exported from external barrel — Plan 23-03 wires it once concrete modules exist"
  - "emitLog uses Record-like indexed dispatch (this.logger[logLevel]) — no switch/case"
  - "call() rethrows original error after logging ERROR — preserves stack for consumer"
metrics:
  duration_min: 2
  completed: 2026-04-15
---

# Phase 23 Plan 02: AbstractGrpcClient Foundation Primitives Summary

## One-liner

Added `AbstractGrpcClient<TRaw>` base class with Promise facade, per-call `grpc-timeout` Metadata deadline, Pino `grpc.client.call` logging with correlationId, and `GrpcClientHealthIndicator` using `grpc.health.v1.Health/Check` — all under `packages/foundation/src/external/grpc/clients/`, not yet barrel-exported (Plan 23-03 wires).

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | clients.constants.ts (no-magic-values: 3 `as const` groups) | b216701 | 1 new |
| 2 | AbstractGrpcClient + logging types + health indicator | 2f5a5b1 | 3 new |

## AbstractGrpcClient Public Signature

```typescript
export abstract class AbstractGrpcClient<TRaw extends object> implements OnModuleInit {
  protected raw!: TRaw;
  constructor(
    grpc: ClientGrpc,
    cls: ClsService,
    serviceName: string,        // ts-proto service name for getService()
    defaultDeadlineMs: number,  // from GRPC_DEADLINE_MS
    logContext: string,          // Pino `context` field (e.g. 'AudienceClient')
  );
  onModuleInit(): void;                                    // calls getService() here (Pitfall 3)
  protected buildMetadata(opts?: CallOpts): Metadata;      // grpc-timeout Nm
  protected call<T>(method: string, obs: Observable<T>): Promise<T>; // lastValueFrom + log
}
```

## Constants Table

| Constant | Value | Purpose |
|---|---|---|
| `GRPC_CLIENT_LOG.EVENT` | `'grpc.client.call'` | Pino log message (D-13) |
| `GRPC_CLIENT_LOG.STATUS_OK` / `STATUS_ERROR` | `'OK'` / `'ERROR'` | Log status field |
| `GRPC_CLIENT_DEADLINE.METADATA_HEADER` | `'grpc-timeout'` | gRPC HTTP/2 spec header |
| `GRPC_CLIENT_DEADLINE.METADATA_UNIT_MILLISECONDS` | `'m'` | ms unit suffix |
| `GRPC_CLIENT_HEALTH.SERVICE_NAME` | `'Health'` | ts-proto service name for getService |
| `GRPC_CLIENT_HEALTH.PACKAGE` | `'grpc.health.v1'` | Multi-package channel (23-03 registers) |
| `GRPC_CLIENT_HEALTH.STATUS_SERVING` | `1` | grpc.health.v1 SERVING enum |
| `GRPC_CLIENT_HEALTH.DOWN_MESSAGE` | `'grpc health unreachable'` | Terminus down message |
| `GRPC_CLIENT_HEALTH.OVERALL_SERVICE_KEY` | `''` | Empty string = overall health |

## Pitfall 6 Avoidance Mechanism

**Problem (from RESEARCH.md):** `PinoLogger#setContext(name)` mutates a shared singleton on the nestjs-pino provider. If two subclasses each call `setContext('AudienceClient')` / `setContext('ParserClient')` during construction, the last one wins and all subsequent logs from any facade carry the same stale `context` field.

**Solution applied:**
- `AbstractGrpcClient` does **not** inject `PinoLogger` via DI.
- Constructor takes a plain `logContext: string` argument and calls `PinoLogger.root.child({ context: logContext })` to derive a per-instance `pino.Logger` child.
- Each subclass gets its own logger object with its own context — no shared mutation.
- Mirrors the precedent set by `packages/foundation/src/external/logging/correlation.interceptor.ts` (same `PinoLogger.root.child` pattern for per-request loggers).

**Enforcement:**
- `grep -c "setContext(" abstract-grpc-client.ts` == **0** ✓
- `grep -c "PinoLogger.root.child" abstract-grpc-client.ts` == **1** ✓
- Will be exercised end-to-end in Plan 23-04 Task 3 Check 4 (gateway instantiates all 5 clients; log audit must show 5 distinct `context` values).

## Other Pitfall Mitigations

| Pitfall | Mechanism | Verified |
|---|---|---|
| 2 (Observable lifecycle) | `lastValueFrom(observable)` in `call()` | grep `lastValueFrom` == 2 |
| 3 (getService in constructor) | `this.raw = this.grpc.getService(...)` inside `onModuleInit()` only | grep `onModuleInit` present; no getService in constructor |
| 4 (deadline interaction) | Per-call `grpc-timeout` Metadata; channel-level interceptor untouched; minimum-wins documented in threat model T-23-02-01 | Deadline interceptor file unmodified |
| 6 (PinoLogger singleton) | `PinoLogger.root.child`; constructor takes `logContext: string`, not DI | See section above |

## Verification Results

- `pnpm --filter @email-platform/foundation build` → exit 0
- `pnpm build` (workspace, 10 tasks) → exit 0, 3 cached + 7 fresh
- `pnpm lint` (7 tasks) → exit 0; only pre-existing warnings in `apps/auth/src/application/use-cases/login.use-case.ts` (4 unused-arg warnings, 2 each in auth + notifier) — unrelated to this plan
- `grep -c "setContext(" abstract-grpc-client.ts` = 0
- `grep -c "PinoLogger.root.child" abstract-grpc-client.ts` = 1
- `grep -c "onModuleInit" abstract-grpc-client.ts` = 1
- `grep -c "lastValueFrom" abstract-grpc-client.ts` = 2
- `grep -c "grpc-timeout" abstract-grpc-client.ts` = 0 (literal lives in constants, not duplicated)
- `grep -cE "switch|case " {abstract-grpc-client,grpc-client-health.indicator}.ts` = 0/0
- `grep -rE "NODE_ENV|isDev|isProd|process.env" packages/foundation/src/external/grpc/clients/` = empty
- AbstractGrpcClient NOT present in `packages/foundation/src/external/index.ts` (barrel) — Plan 23-03 will add it

## Deviations from Plan

**Frontmatter vs. plan body discrepancy (resolved — no deviation):**
- `files_modified` in frontmatter listed `packages/foundation/src/external/resilience/grpc-deadline.interceptor.ts`.
- Plan `<objective>` and `<tasks>` bodies explicitly state: *"Deadline interceptor is left unchanged — per-call deadline is layered on top via Metadata (RESEARCH.md D-11/D-12, Pitfall 4)"*.
- Plan body takes precedence (acceptance criteria, verification, and all task actions do not touch the interceptor).
- Outcome: interceptor untouched, matches CONTEXT.md D-11 ("сохраняется глобальный channel-level deadline") and D-12 ("добавляется опциональный per-call override" — implemented via Metadata layer).

No other deviations. Plan executed exactly as written.

## Known Stubs

None. All code is real implementation. The only lifecycle stub is `this.raw!: TRaw` (definite-assignment assertion) — populated in `onModuleInit()` before any `call()` can be invoked via Nest DI lifecycle.

## Threat Flags

None. Threat model T-23-02-01..04 in plan already covers all surface; no new trust boundaries introduced beyond what the plan anticipated.

## Self-Check: PASSED

**Files:**
- `packages/foundation/src/external/grpc/clients/clients.constants.ts` — FOUND
- `packages/foundation/src/external/grpc/clients/grpc-client-logging.types.ts` — FOUND
- `packages/foundation/src/external/grpc/clients/abstract-grpc-client.ts` — FOUND
- `packages/foundation/src/external/grpc/clients/grpc-client-health.indicator.ts` — FOUND

**Commits:**
- `b216701` (Task 1 constants) — FOUND in git log
- `2f5a5b1` (Task 2 base + types + health) — FOUND in git log

## Next Steps

Plan 23-03 will:
- Create 5 per-service modules (`AudienceClientModule`, `AuthClientModule`, `ParserClientModule`, `SenderClientModule`, `NotifierClientModule`) under `packages/foundation/src/external/grpc/clients/{service}/`.
- Each module registers `ClientsModule` with multi-package channel (service proto + `grpc.health.v1` from `grpc-health-check` package).
- Each module extends `AbstractGrpcClient<TRaw>` with typed method facades.
- Wire AbstractGrpcClient + per-service modules into `packages/foundation/src/external/index.ts` barrel.

Plan 23-04 will:
- Consume modules in gateway (all 5), sender (2), notifier (implicit via audience), and migrate `apps/gateway/src/test/storage-smoke.controller.ts` from local string tokens to `SERVICE.x.diToken` (symbol).
- End-to-end Pitfall 6 verification: boot gateway, run smoke RPC, audit logs to confirm 5 distinct `context` values.
