---
phase: 23
slug: grpc-client-typed-wrappers
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-15
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `23-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `pnpm build` (tsc) + runtime smoke via gateway HTTP endpoints. No Jest — project charter defers testing to a separate milestone. |
| **Config file** | `tsconfig.base.json` + per-package `tsconfig.json` |
| **Quick run command** | `pnpm build` (Turbo, affected-only) |
| **Full suite command** | `pnpm build && pnpm lint` workspace-wide + manual smoke (parser/notifier storage smoke + readiness curl) |
| **Estimated runtime** | ~30s build (cached) / ~120s cold; smoke ~5s per endpoint |

---

## Sampling Rate

- **After every task commit:** `pnpm build` (per-package, Turbo affected-only)
- **After every plan wave:** `pnpm build && pnpm lint` workspace-wide
- **Before `/gsd-verify-work`:** Full build + lint green; smoke endpoints `200 OK`
- **Max feedback latency:** ~30s cached build

---

## Per-Task Verification Map

> Filled by planner per-task once PLAN.md exists. Initial map keyed to phase requirements:

| Req ID | Plan | Wave | Behavior | Test Type | Automated Command / Observable Signal | File Exists | Status |
|--------|------|------|----------|-----------|---------------------------------------|-------------|--------|
| GRPC-01 | TBD | TBD | Wrong method on facade → compile error | typecheck | `pnpm build` fails on `audience.nonExistentMethod(x)` in sanity probe | ❌ W0 | ⬜ pending |
| GRPC-01 | TBD | TBD | Wrong request type → compile error | typecheck | `pnpm build` fails on `audience.listRecipients({ wrongField: 1 })` | ❌ W0 | ⬜ pending |
| GRPC-02 | TBD | TBD | Consumer imports only needed clients | audit | Grep service `*.module.ts` shows only required `*ClientModule` imports | ✅ existing | ⬜ pending |
| GRPC-03 | TBD | TBD | Gateway has all 5 typed clients | audit + runtime | `apps/gateway/src/infrastructure/clients/grpc-clients.module.ts` imports 5 `*ClientModule.forRoot()`; readiness reports 5 upstreams | ✅ existing | ⬜ pending |
| GRPC-04 | TBD | TBD | Default deadline enforced | runtime | Stop backend → call returns DEADLINE_EXCEEDED within `GRPC_DEADLINE_MS` | ✅ existing smoke | ⬜ pending |
| GRPC-04 | TBD | TBD | Per-call deadline shortens | runtime | `parser.runStorageSmoke({}, { deadlineMs: 1 })` against live backend → DEADLINE_EXCEEDED | ❌ W0 (probe) | ⬜ pending |
| D-06/07 | TBD | TBD | Symbol catalog compiles | typecheck | `pnpm build` in packages/config + foundation + all apps green | ✅ existing | ⬜ pending |
| D-08 | TBD | TBD | Smoke migration intact | runtime | `curl :4000/test/parser/storage-service` returns same shape post-refactor | ✅ existing | ⬜ pending |
| D-09/10 | TBD | TBD | Health reflects upstream | runtime | Kill parser → readiness shows parser down within `HEALTH.CHECK_TIMEOUT` ms | ✅ existing pattern | ⬜ pending |
| D-13 | TBD | TBD | Client log lines emitted | log inspection | Gateway logs contain `"grpc.client.call"` with service/method/duration_ms/correlationId | — runtime only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/gateway/src/test/grpc-client-sanity.ts` — compile-time probe: one file exercising all typed method signatures to lock GRPC-01 observable (typecheck-only file, never imported at runtime).
- [ ] No Jest install — project charter defers ("Testing — отдельный следующий этап").

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Health reflects upstream down/up | D-09/10, GRPC-04 | Requires running backend stack, kill/restart cycle | `pnpm dev`, kill parser process, `curl :4000/health/ready` shows parser down; restart, verify recovers |
| Per-call deadline override | GRPC-04 | Requires live gRPC call against running upstream | Add temporary smoke endpoint with `deadlineMs: 1`, observe DEADLINE_EXCEEDED in response |
| Client-side log emission | D-13 | Requires correlation flow + log inspection | Hit smoke endpoint, `docker logs gateway \| grep grpc.client.call`, verify fields present |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (sanity probe file)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (cached build)
- [ ] `nyquist_compliant: true` set in frontmatter once planner fills task IDs

**Approval:** pending
