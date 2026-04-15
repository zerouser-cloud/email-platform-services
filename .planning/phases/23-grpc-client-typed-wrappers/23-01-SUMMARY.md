---
phase: 23
plan: 01
subsystem: grpc-client
tags: [grpc, di-tokens, symbol-for, catalog, foundation-cleanup]
requires: []
provides:
  - "SERVICE.x.diToken typed as symbol (Symbol.for registry)"
  - "Foundation external barrel free of obsolete GrpcClientModule"
affects:
  - packages/config (public type surface: GrpcServiceDeclaration.diToken)
  - packages/foundation (removed export)
tech-stack:
  added: []
  patterns:
    - "Symbol.for() for cross-package stable DI token identity"
key-files:
  created: []
  modified:
    - packages/config/src/catalog/types.ts
    - packages/config/src/catalog/define-service.ts
    - packages/foundation/src/external/index.ts
  deleted:
    - packages/foundation/src/external/grpc/grpc-client.module.ts
decisions:
  - "D-06/D-07 enforced: diToken is symbol, built via Symbol.for(), not bare Symbol()"
  - "Obsolete GrpcClientModule.register() deleted — zero consumers confirmed via workspace grep"
metrics:
  duration: ~2min
  completed: 2026-04-15
---

# Phase 23 Plan 01: Symbol Catalog Migration + Dead Module Removal Summary

One-liner: Migrated `SERVICE.*.diToken` from plain string to `Symbol.for()` (stable cross-package identity) and removed the unused `GrpcClientModule.register()` helper from `@email-platform/foundation`.

## What Changed

### Task 1 — diToken → symbol (commit `26c4d63`)

- `packages/config/src/catalog/types.ts:16` — `readonly diToken: string` → `readonly diToken: symbol`.
- `packages/config/src/catalog/define-service.ts:42` — token construction switched from template-literal strings to `Symbol.for(\`${upperId}_GRPC_CLIENT\`)` / `Symbol.for(\`${upperId}_CLIENT\`)`.
- Rationale (Pitfall 1 from research): `Symbol.for()` uses the global symbol registry so that different transitive imports of `@email-platform/config` resolve to the *same* symbol. Bare `Symbol()` would silently break DI once the catalog is used across multiple bundler chunks.

### Task 2 — Delete obsolete GrpcClientModule (commit `5885887`)

- Deleted `packages/foundation/src/external/grpc/grpc-client.module.ts` (40-line `register()` wrapper).
- Removed the matching line from `packages/foundation/src/external/index.ts` barrel.
- Pre-delete audit: `grep -rn "GrpcClientModule" --include=*.ts` across repo returned only the declaration file + barrel — confirming zero app-code consumers (matches research § Migration Risks A6).

## Verification Results

| Check | Result |
|-------|--------|
| `grep -n "readonly diToken: symbol;" packages/config/src/catalog/types.ts` | 1 match (line 16) |
| `grep -o "Symbol.for(" packages/config/src/catalog/define-service.ts \| wc -l` | 2 |
| Bare `Symbol(` calls in define-service.ts (excluding `Symbol.for`) | 0 |
| `readonly diToken: string` remaining in types.ts | 0 |
| File `packages/foundation/src/external/grpc/grpc-client.module.ts` exists | No (deleted) |
| `grep "grpc-client.module" packages/foundation/src/external/index.ts` | 0 matches |
| `grep -rn "GrpcClientModule" apps/ packages/` | 0 matches |
| `pnpm build` workspace-wide | 10/10 tasks green (~4.9s) |
| `pnpm lint` workspace-wide | 7/7 tasks, 0 errors (2 pre-existing notifier warnings unrelated — out of scope per CLAUDE.md) |

### Runtime Success Criteria (#1, #2 from plan)

Inspected via `node -e` against compiled `packages/config/dist`:

```
auth      symbol  Symbol(AUTH_GRPC_CLIENT)     keyFor: AUTH_GRPC_CLIENT
sender    symbol  Symbol(SENDER_GRPC_CLIENT)   keyFor: SENDER_GRPC_CLIENT
parser    symbol  Symbol(PARSER_GRPC_CLIENT)   keyFor: PARSER_GRPC_CLIENT
audience  symbol  Symbol(AUDIENCE_GRPC_CLIENT) keyFor: AUDIENCE_GRPC_CLIENT
gateway   symbol  Symbol(GATEWAY_CLIENT)       keyFor: GATEWAY_CLIENT
notifier  symbol  Symbol(NOTIFIER_GRPC_CLIENT) keyFor: NOTIFIER_GRPC_CLIENT
```

`typeof SERVICE.x.diToken === 'symbol'` confirmed for all 6 entries; `Symbol.keyFor(...)` returns the expected registry key (proves `Symbol.for` — bare `Symbol()` would return `undefined`).

## Deviations from Plan

None — plan executed exactly as written. Both tasks completed without triggering Rule 1/2/3/4 auto-fixes.

## Pre-existing Warnings (Out of Scope)

`pnpm lint` reports 2 warnings in `apps/notifier/src/infrastructure/messaging/rabbitmq-event.subscriber.ts` (unused `eventType`/`payload` parameters). These predate this plan — logged for future cleanup, not fixed here (Scope Boundary rule: only auto-fix issues directly caused by current-task changes).

## Commits

| Hash | Message |
|------|---------|
| `26c4d63` | `feat(23-01): migrate SERVICE.diToken from string to Symbol.for()` |
| `5885887` | `chore(23-01): delete obsolete GrpcClientModule and drop barrel export` |

## Threat Flags

None — type-level change + dead-code removal introduced no new trust boundary, network surface, or auth path.

## Self-Check: PASSED

- FOUND: packages/config/src/catalog/types.ts (diToken: symbol)
- FOUND: packages/config/src/catalog/define-service.ts (Symbol.for × 2)
- MISSING (by design): packages/foundation/src/external/grpc/grpc-client.module.ts
- FOUND: commit 26c4d63 in git log
- FOUND: commit 5885887 in git log
