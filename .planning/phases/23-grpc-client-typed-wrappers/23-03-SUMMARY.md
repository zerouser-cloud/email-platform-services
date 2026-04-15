---
phase: 23
plan: 03
subsystem: foundation/grpc-clients
tags: [grpc, client, facade, per-service-module, health, terminus, pitfall-6]
requires:
  - 23-02 (AbstractGrpcClient + GrpcClientHealthIndicator primitives)
provides:
  - AudienceClientModule.forRoot() + AudienceClient facade + AUDIENCE_GRPC_HEALTH
  - AuthClientModule.forRoot() + AuthClient facade + AUTH_GRPC_HEALTH
  - ParserClientModule.forRoot() + ParserClient facade + PARSER_GRPC_HEALTH
  - SenderClientModule.forRoot() + SenderClient facade + SENDER_GRPC_HEALTH
  - NotifierClientModule.forRoot() + NotifierClient facade + NOTIFIER_GRPC_HEALTH
  - foundation barrel re-exports all 5 modules + 5 facades + 5 health tokens + CallOpts
affects:
  - Plan 23-04 (gateway verification consumes all 5 modules; sender consumes 2)
tech-stack:
  added: []
  patterns:
    - ClientsModule.registerAsync multi-package (service proto + grpc.health.v1) — Assumption A3 used directly, no fallback needed
    - require.resolve('grpc-health-check/proto/health/v1/health.proto') — works in CJS output (tsconfig module=node16)
    - Symbol.for() for DI tokens (Pitfall 1)
    - Per-module internal CLIENT_GRPC symbol distinct from consumer-facing SERVICE.x.diToken (Pitfall 5)
    - Concrete subclass passes class name to super() as logContext string — no PinoLogger DI (Pitfall 6)
key-files:
  created:
    - packages/foundation/src/external/grpc/clients/audience/audience-client.constants.ts
    - packages/foundation/src/external/grpc/clients/audience/audience.client.ts
    - packages/foundation/src/external/grpc/clients/audience/audience-client.module.ts
    - packages/foundation/src/external/grpc/clients/auth/auth-client.constants.ts
    - packages/foundation/src/external/grpc/clients/auth/auth.client.ts
    - packages/foundation/src/external/grpc/clients/auth/auth-client.module.ts
    - packages/foundation/src/external/grpc/clients/parser/parser-client.constants.ts
    - packages/foundation/src/external/grpc/clients/parser/parser.client.ts
    - packages/foundation/src/external/grpc/clients/parser/parser-client.module.ts
    - packages/foundation/src/external/grpc/clients/sender/sender-client.constants.ts
    - packages/foundation/src/external/grpc/clients/sender/sender.client.ts
    - packages/foundation/src/external/grpc/clients/sender/sender-client.module.ts
    - packages/foundation/src/external/grpc/clients/notifier/notifier-client.constants.ts
    - packages/foundation/src/external/grpc/clients/notifier/notifier.client.ts
    - packages/foundation/src/external/grpc/clients/notifier/notifier-client.module.ts
    - packages/foundation/src/external/grpc/clients/index.ts
  modified:
    - packages/foundation/src/external/index.ts
decisions:
  - "Multi-package registration (Assumption A3) worked on first try — no second ClientsModule.registerAsync needed for grpc.health.v1"
  - "require.resolve used directly — no createRequire fallback required (tsconfig module=node16 emits CJS)"
  - "Rule 1 auto-fix: facade methods reference CommonProto.Empty/HealthStatus instead of AudienceProto.Empty (plan body contained wrong namespace; generated code imports these from common.proto)"
metrics:
  duration_min: 8
  completed: 2026-04-15
---

# Phase 23 Plan 03: Per-Service gRPC Client Modules Summary

## One-liner

Delivered five self-contained NestJS `*ClientModule.forRoot()` dynamic modules (Audience/Auth/Parser/Sender/Notifier) under `packages/foundation/src/external/grpc/clients/`, each pairing a hand-typed Promise facade (38 methods total) with a `GrpcClientHealthIndicator` over `grpc.health.v1` on the same channel; wired through the foundation barrel.

## Tasks Completed

| # | Task                                             | Commit  | Files       |
| - | ------------------------------------------------ | ------- | ----------- |
| 1 | AudienceClientModule (reference implementation) | 09d73bd | 3 new       |
| 2 | Auth + Parser + Sender + Notifier + barrel       | 46c7446 | 12 new, 2 mod |

## Per-Facade Method Counts

| Facade          | Expected (ts-proto) | Actual | Match |
| --------------- | ------------------- | ------ | ----- |
| AudienceClient  | 9                   | 9      | ✓     |
| AuthClient      | 7                   | 7      | ✓     |
| ParserClient    | 8                   | 8      | ✓     |
| SenderClient    | 11                  | 11     | ✓     |
| NotifierClient  | 3                   | 3      | ✓     |
| **Total**       | **38**              | **38** | **✓** |

## Assumption A3 (Multi-Package ClientGrpc) — Outcome

Used directly as primary registration; no fallback needed. Each `ClientsModule.registerAsync` entry:

```typescript
package: [SERVICE.x.grpc.package, GRPC_CLIENT_HEALTH.PACKAGE],  // 'grpc.health.v1'
protoPath: [
  resolveProtoPath(SERVICE.x.grpc.package, config.get<string>('PROTO_DIR')!),
  require.resolve('grpc-health-check/proto/health/v1/health.proto'),
],
```

`pnpm build` workspace exit 0 on first try — NestJS v11 accepts the multi-package array form. Fallback path (separate `ClientsModule.registerAsync` entry for `grpc.health.v1`) documented in RESEARCH.md but not triggered.

## require.resolve vs createRequire — Outcome

CJS path taken. `tsconfig.base.json` has `module: node16`, `moduleResolution: node16` — TypeScript emits CommonJS for this runtime combination, so `require` is a free-standing global in the compiled output. `require.resolve('grpc-health-check/proto/health/v1/health.proto')` resolves to `node_modules/.pnpm/grpc-health-check@2.1.0/node_modules/grpc-health-check/proto/health/v1/health.proto` at runtime (package includes `proto/` in its `files` array).

`createRequire(import.meta.url)` ESM fallback **not needed**; did not apply. Foundation build passed without any shim.

## Pitfall 6 Enforcement

No concrete subclass or per-service module factory imports or injects `PinoLogger`:

```
grep -Rc "PinoLogger" packages/foundation/src/external/grpc/clients/{audience,auth,parser,sender,notifier}/ → 0 across all 15 files
```

Each `XClient` constructor takes only `(grpc, cls, defaultDeadlineMs)` and calls `super(..., XClient.name)` — the class name string is the `logContext` that `AbstractGrpcClient` passes to `PinoLogger.root.child({ context })`. Every facade instance gets a distinct pino child, preventing the shared-singleton mutation trap.

Each `facadeProvider.inject` array lists `[X_CLIENT_GRPC, ClsService, ConfigService]` — **no `PinoLogger` token**.

## Pitfall 5 (Symbol Distinctness) Enforcement

Each module defines its own internal `Symbol.for('X_CLIENT_GRPC')` for the `ClientsModule` name, distinct from the consumer-facing `SERVICE.x.diToken` (which is `Symbol.for('X_GRPC_CLIENT')` produced by `defineService()`). The internal symbol is never exported through the foundation barrel — `grep -c "CLIENT_GRPC" packages/foundation/src/external/grpc/clients/index.ts` → 0.

## Foundation Barrel Surface

| Exported              | Count | Names                                                                                                            |
| --------------------- | ----- | ---------------------------------------------------------------------------------------------------------------- |
| `*ClientModule`       | 5     | Audience, Auth, Parser, Sender, Notifier                                                                         |
| `*Client` facade      | 5     | AudienceClient, AuthClient, ParserClient, SenderClient, NotifierClient                                           |
| `*_GRPC_HEALTH` token | 5     | AUDIENCE_GRPC_HEALTH, AUTH_GRPC_HEALTH, PARSER_GRPC_HEALTH, SENDER_GRPC_HEALTH, NOTIFIER_GRPC_HEALTH             |
| Types                 | 1     | `CallOpts`                                                                                                       |

**Not exported (private to foundation):** `AbstractGrpcClient`, `GrpcClientHealthIndicator`, `*_CLIENT_GRPC`, `clients.constants`.

## Verification Results

- `pnpm --filter @email-platform/foundation build` → exit 0
- `pnpm build` (workspace, 10 tasks) → exit 0, 3 cached + 7 fresh, 4.1s
- `pnpm lint` (7 tasks) → exit 0; only 2 pre-existing warnings in `apps/notifier/src/application/use-cases/route-event.use-case.ts` (unused `eventType`/`payload` args) — unrelated to this plan
- `grep -c "provide: SERVICE.audience.diToken" .../audience-client.module.ts` = 1 ✓
- `grep -c "provide: AUDIENCE_GRPC_HEALTH" .../audience-client.module.ts` = 1 ✓
- `grep -c "grpc.health.v1" .../audience-client.module.ts` = 0 (literal lives in `GRPC_CLIENT_HEALTH.PACKAGE` constant, not duplicated) ✓
- `grep -c "Symbol.for(" .../audience-client.constants.ts` = 2 ✓ (same pattern for all 5 services)
- `grep -c "export { .*ClientModule }" .../clients/index.ts` = 5 ✓
- `grep -c "export { .*_GRPC_HEALTH }" .../clients/index.ts` = 5 ✓
- `grep -c "CLIENT_GRPC" .../clients/index.ts` = 0 ✓ (internals private)
- `grep -c "AbstractGrpcClient" packages/foundation/src/external/index.ts` = 0 ✓ (primitives private)
- `grep -Rc "PinoLogger" .../clients/{audience,auth,parser,sender,notifier}/` = 0 across all 15 files ✓
- `grep -REc "switch|case " .../clients/` = 0 across all files ✓
- `grep -RE "NODE_ENV|isDev|isProd" .../clients/` = empty ✓
- Method counts per facade.client.ts (subtracting 1 for constructor): audience=9, auth=7, parser=8, sender=11, notifier=3 ✓

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Plan referenced `AudienceProto.Empty` / `AudienceProto.HealthStatus` which do not exist**

- **Found during:** Task 1 initial build (TS2694 on 5 method signatures)
- **Issue:** The plan's reference implementation used `AudienceProto.Empty` and `AudienceProto.HealthStatus` in method signatures. The generated `packages/contracts/src/generated/audience.ts` imports these types from `./common` and does not re-export them, so they are not members of the `AudienceProto` namespace produced by `packages/contracts/src/index.ts` (`export * as AudienceProto from './generated/audience'`).
- **Fix:** Added `CommonProto` to the named import (`import { AudienceProto, CommonProto } from '@email-platform/contracts';`) and replaced the 5 references across all 5 facade files (`healthCheck` × 5, `deleteGroup`, `markAsSent`, `resetSendStatus`, `revokeToken`, `getSettings`, `runStorageSmoke` on parser, `runStorageSmoke` / `healthCheck` on notifier, etc.) with `CommonProto.Empty` / `CommonProto.HealthStatus`. Same treatment applied uniformly to auth, parser, sender, notifier facades.
- **Files modified:** all 5 `*.client.ts` (15 method signatures touched)
- **Commit:** 09d73bd (audience), 46c7446 (others)

**2. [Rule 1 — Cosmetic] Removed PinoLogger mentions from comments in AudienceClient**

- **Found during:** Acceptance-criteria check after Task 1
- **Issue:** The plan's reference implementation included explanatory comments that literally contained the string `PinoLogger`; the plan's own acceptance criterion requires `grep -c "PinoLogger" .../audience.client.ts` = 0.
- **Fix:** Reworded comments to reference "base class" / "root pino" while preserving the Pitfall 6 explanation. Functional code unchanged.
- **Files modified:** `packages/foundation/src/external/grpc/clients/audience/audience.client.ts` (comment text only)
- **Commit:** 46c7446

No Rule 2/3 issues. No Rule 4 (architectural) decisions required. Plan bodies for Tasks 1 and 2 executed otherwise exactly as written.

## Known Stubs

None. All 15 per-service files are real implementations. No TODO/FIXME markers. No consumer wire-up — that is intentionally deferred to Plan 23-04.

## Threat Flags

None. No new trust boundaries beyond those anticipated in the plan's threat model (T-23-03-01..03 already cover the health-check channel surface, the Symbol.for collision, and the `grpc.health.v1` exposure).

## Self-Check: PASSED

**Files:**
- `packages/foundation/src/external/grpc/clients/audience/audience-client.constants.ts` — FOUND
- `packages/foundation/src/external/grpc/clients/audience/audience.client.ts` — FOUND
- `packages/foundation/src/external/grpc/clients/audience/audience-client.module.ts` — FOUND
- `packages/foundation/src/external/grpc/clients/auth/auth-client.constants.ts` — FOUND
- `packages/foundation/src/external/grpc/clients/auth/auth.client.ts` — FOUND
- `packages/foundation/src/external/grpc/clients/auth/auth-client.module.ts` — FOUND
- `packages/foundation/src/external/grpc/clients/parser/parser-client.constants.ts` — FOUND
- `packages/foundation/src/external/grpc/clients/parser/parser.client.ts` — FOUND
- `packages/foundation/src/external/grpc/clients/parser/parser-client.module.ts` — FOUND
- `packages/foundation/src/external/grpc/clients/sender/sender-client.constants.ts` — FOUND
- `packages/foundation/src/external/grpc/clients/sender/sender.client.ts` — FOUND
- `packages/foundation/src/external/grpc/clients/sender/sender-client.module.ts` — FOUND
- `packages/foundation/src/external/grpc/clients/notifier/notifier-client.constants.ts` — FOUND
- `packages/foundation/src/external/grpc/clients/notifier/notifier.client.ts` — FOUND
- `packages/foundation/src/external/grpc/clients/notifier/notifier-client.module.ts` — FOUND
- `packages/foundation/src/external/grpc/clients/index.ts` — FOUND
- `packages/foundation/src/external/index.ts` — FOUND (modified)

**Commits:**
- `09d73bd` (Task 1 — AudienceClientModule) — FOUND in git log
- `46c7446` (Task 2 — Auth/Parser/Sender/Notifier + barrel) — FOUND in git log

## Next Steps

Plan 23-04 will consume these modules:
- Gateway imports all 5 `*ClientModule.forRoot()` in the root module and wires them into the health controller + storage-smoke controller.
- Sender imports `AudienceClientModule` and `NotifierClientModule` for cross-service RPC.
- End-to-end Pitfall 6 verification: boot gateway, run smoke RPCs, audit `grpc.client.call` log events — expect 5 distinct `context` values (one per facade), proving the `PinoLogger.root.child` per-instance pattern holds across concurrent clients.
