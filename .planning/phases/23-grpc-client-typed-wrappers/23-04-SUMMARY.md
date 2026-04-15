---
phase: 23
plan: 04
subsystem: gateway/grpc-client-wiring
tags: [grpc, client, gateway, health, readiness, smoke-migration, sanity-probe, pitfall-6]
requires:
  - 23-03 (AudienceClientModule..NotifierClientModule + *_GRPC_HEALTH tokens + *Client facades)
provides:
  - GrpcClientsModule aggregating all 5 per-service client modules (D-05)
  - StorageSmokeController on typed ParserClient/NotifierClient via SERVICE.x.diToken (D-08)
  - HealthController readiness wired to 5 GrpcClientHealthIndicator instances (D-10, notifier included)
  - grpc-client-sanity.ts end-of-phase typecheck probe locking GRPC-01 observable
  - VALIDATION.md nyquist_compliant:true + wave_0_complete:true
affects:
  - Phase 23 completion (Task 3 = human verify checkpoint)
tech-stack:
  added: []
  patterns:
    - DynamicModule re-export chain (GrpcClientsModule exports 5 *ClientModule classes)
    - Promise.allSettled over 5 grpc.health.v1 probes per readiness request
    - End-of-phase typecheck probe via @ts-expect-error + file-level ESLint disable
key-files:
  created:
    - apps/gateway/src/test/grpc-client-sanity.ts
  modified:
    - apps/gateway/src/infrastructure/clients/grpc-clients.module.ts
    - apps/gateway/src/test/smoke-test.module.ts
    - apps/gateway/src/test/storage-smoke.controller.ts
    - apps/gateway/src/health/health.controller.ts
    - packages/foundation/src/external/grpc/clients/index.ts
    - .planning/phases/23-grpc-client-typed-wrappers/23-VALIDATION.md
  deleted:
    - apps/gateway/src/test/smoke-test.tokens.ts
decisions:
  - "Rule 3 fix: exported GrpcClientHealthIndicator from foundation barrel (required for health controller injection typing; 23-03 summary had kept it private)"
  - "Rule 1 fix: sanity probe uses CommonProto.Empty for Notifier.runStorageSmoke request (mirrors 23-03 fix — NotifierProto.Empty does not exist)"
  - "VALIDATION.md per-task map already had Plan/Wave columns filled by prior wave — only flipped frontmatter flags + ticked sign-off boxes"
metrics:
  duration_min: 6
  completed: 2026-04-15
  tasks_completed: 2
  tasks_total: 3
  pending: "Task 3 = checkpoint:human-verify"
---

# Phase 23 Plan 04: Gateway gRPC Client Wiring Summary (Tasks 1-2 of 3)

## One-liner

Wired gateway to consume foundation's 5 typed gRPC client modules: `GrpcClientsModule` composes all 5 via `*ClientModule.forRoot()`; smoke controller injects `ParserClient`/`NotifierClient` via `SERVICE.x.diToken`; readiness probes `grpc.health.v1.Health/Check` per upstream via 5 `GrpcClientHealthIndicator`s (notifier newly included); end-of-phase `grpc-client-sanity.ts` locks GRPC-01 compile-time observable with `@ts-expect-error` negatives.

## Tasks Completed (2 of 3)

| # | Task                                                                                   | Commit  | Files                |
| - | -------------------------------------------------------------------------------------- | ------- | -------------------- |
| 1 | Wire GrpcClientsModule + migrate smoke controller + delete smoke-test.tokens.ts        | b22b8ed | 4 changed (1 deleted) |
| 2 | Readiness on 5 GrpcClientHealthIndicators + grpc-client-sanity.ts probe                | a48b837 | 3 changed (1 new)    |
| 2 | VALIDATION.md nyquist_compliant:true + sign-off ticks                                  | 3e5f021 | 1 changed            |
| 3 | Human verification (6 end-to-end checks)                                               | PENDING | n/a                  |

## Acceptance Criteria — Tasks 1+2

| Check                                                                                        | Result |
| -------------------------------------------------------------------------------------------- | ------ |
| `smoke-test.tokens.ts` deleted                                                               | ✓ OK   |
| `grpc-clients.module.ts` has 5× `.forRoot()`                                                 | ✓ 5    |
| Smoke controller has `@Inject(SERVICE.parser.diToken)` + `@Inject(SERVICE.notifier.diToken)` | ✓ 2    |
| Smoke controller has zero `firstValueFrom` / `OnModuleInit` / `ClientGrpc`                   | ✓ 0    |
| No `PARSER_SMOKE_CLIENT` / `NOTIFIER_SMOKE_CLIENT` in `.ts` sources                          | ✓ (only stale dist .d.ts) |
| Sanity probe head line 1 matches ESLint disable directive                                    | ✓ OK   |
| Sanity probe contains `@ts-expect-error` directives                                          | ✓ 2 active (+1 inside comment) |
| `health.controller.ts` imports 5× `*_GRPC_HEALTH`                                            | ✓ 10 refs (5 imports + 5 @Inject) |
| `health.controller.ts` has zero `GRPCHealthIndicator` / `healthServiceCheck`                 | ✓ 0    |
| `Promise.allSettled` in readiness                                                            | ✓ 1    |
| VALIDATION.md `nyquist_compliant: true`                                                      | ✓ OK   |
| VALIDATION.md `wave_0_complete: true`                                                        | ✓ OK   |
| `pnpm build` workspace                                                                       | ✓ 10/10 exit 0, 4.149s |
| `pnpm lint` workspace                                                                        | ✓ 7/7 exit 0 (2 pre-existing notifier warnings unrelated) |
| `pnpm lint --filter @email-platform/gateway`                                                 | ✓ cached hit, exit 0 |

## GrpcClientsModule Composition

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
    AuthClientModule,
    SenderClientModule,
    ParserClientModule,
    AudienceClientModule,
    NotifierClientModule,
  ],
})
export class GrpcClientsModule {}
```

Re-export pattern (C from RESEARCH.md) — consumer importing `GrpcClientsModule` transitively sees all 5 `SERVICE.x.diToken` providers + 5 `*_GRPC_HEALTH` providers.

## Readiness Flow

```
GET /health/ready
  → Promise.allSettled([
      authHealth.isHealthy('auth'),
      senderHealth.isHealthy('sender'),
      parserHealth.isHealthy('parser'),
      audienceHealth.isHealthy('audience'),
      notifierHealth.isHealthy('notifier'),
    ])
  → health.check(…)   // terminus aggregation
```

Each `GrpcClientHealthIndicator.isHealthy()` issues `grpc.health.v1.Health/Check` on the shared channel bound to its upstream — same connection the typed facade uses, so readiness reflects real channel state.

Notifier is now included (was missing from the prior inline `GRPCHealthIndicator.checkService` list). Per D-10.

## Sanity Probe Mechanics

`apps/gateway/src/test/grpc-client-sanity.ts`:

- File-level ESLint disable (line 1) targets exactly `no-unused-vars` + `no-unused-expressions` — no blanket disable.
- 5 positive cases exercise `auth.login`, `sender.listCampaigns`, `parser.listTasks`, `audience.listGroups`, `notifier.runStorageSmoke`.
- 2 `@ts-expect-error`-guarded negative cases: `audience.nonExistentMethod({})` and `audience.listRecipients({ wrongField: 1 })`.
- Compiled by `pnpm build` alongside gateway app; never imported at runtime.
- If ts-proto interfaces change and the "wrong" call becomes valid, tsc fails on the unused directive — self-healing probe.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `GrpcClientHealthIndicator` not exported from foundation barrel**

- **Found during:** Task 2 health.controller.ts first-write — plan imports `GrpcClientHealthIndicator` from `@email-platform/foundation` for typing injected fields.
- **Issue:** Plan 23-03 summary explicitly kept `GrpcClientHealthIndicator` private ("Not exported (private to foundation): `AbstractGrpcClient`, `GrpcClientHealthIndicator`"), but 23-04 requires consumer-side injection with typed fields.
- **Fix:** Added `export { GrpcClientHealthIndicator } from './grpc-client-health.indicator';` to `packages/foundation/src/external/grpc/clients/index.ts`. The class itself is unchanged; only its surface became public. `AbstractGrpcClient` remains private (not required by consumers).
- **Files modified:** `packages/foundation/src/external/grpc/clients/index.ts`
- **Commit:** `a48b837`

**2. [Rule 1 — Bug] Sanity probe used `NotifierProto.Empty` (does not exist)**

- **Found during:** Pre-write verification of proto types — same pattern as 23-03 deviation #1.
- **Issue:** `Empty` lives in `packages/contracts/src/generated/common.ts` and is imported (not re-exported) by notifier-generated code. `NotifierProto.Empty` is not a valid type reference; generates TS2694.
- **Fix:** Added `CommonProto` to the proto namespace import and used `{} as CommonProto.Empty` in the `notifier.runStorageSmoke` positive case.
- **Files modified:** `apps/gateway/src/test/grpc-client-sanity.ts`
- **Commit:** `a48b837`

No Rule 2 or Rule 4 issues. Plan bodies otherwise executed as written.

## Task 3 Pending — Human Verification

Six checks queued for human execution (see plan body `<how-to-verify>`). Summary:

1. `curl /test/parser/storage-service` and `curl /test/notifier/storage-service` — same JSON shape as pre-refactor
2. `curl /health/ready` — all 5 upstreams status `up`
3. Kill parser → readiness flips parser to `down` within `HEALTH.CHECK_TIMEOUT`
4. **Pitfall 6 end-to-end proof:** `docker logs gateway | grep grpc.client.call | jq -r .context | sort -u` shows `ParserClient` + `NotifierClient` (distinct)
5. `pnpm build && pnpm lint` — green
6. `grep -rn "PARSER_SMOKE_CLIENT\|NOTIFIER_SMOKE_CLIENT\|GrpcClientModule" apps/ packages/ --include="*.ts"` — zero matches

## Known Stubs

None. All integration points wired. No TODO/FIXME left.

## Threat Flags

None. All new surface matches plan threat register (T-23-04-01..04).

## Self-Check: PASSED

**Files:**
- `apps/gateway/src/infrastructure/clients/grpc-clients.module.ts` — FOUND
- `apps/gateway/src/test/smoke-test.module.ts` — FOUND
- `apps/gateway/src/test/storage-smoke.controller.ts` — FOUND
- `apps/gateway/src/test/grpc-client-sanity.ts` — FOUND
- `apps/gateway/src/health/health.controller.ts` — FOUND (modified)
- `packages/foundation/src/external/grpc/clients/index.ts` — FOUND (modified)
- `.planning/phases/23-grpc-client-typed-wrappers/23-VALIDATION.md` — FOUND (modified)
- `apps/gateway/src/test/smoke-test.tokens.ts` — ABSENT (expected, deleted)

**Commits:**
- `b22b8ed` (Task 1) — FOUND in git log
- `a48b837` (Task 2 code) — FOUND in git log
- `3e5f021` (Task 2 docs) — FOUND in git log

## Next Steps

Human operator runs the 6 checks via `pnpm dev` + curl + log inspection. On "approved", phase 23 is complete and roadmap advances.
