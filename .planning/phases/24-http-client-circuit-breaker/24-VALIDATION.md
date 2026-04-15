---
phase: 24
slug: http-client-circuit-breaker
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-15
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `24-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `pnpm build` (tsc) + `pnpm lint` + manual smoke endpoints. No Jest — project charter defers. |
| **Config file** | `tsconfig.base.json` + per-package `tsconfig.json` |
| **Quick run command** | `pnpm build` (Turbo affected-only) |
| **Full suite command** | `pnpm build && pnpm lint` workspace-wide |
| **Estimated runtime** | ~30s build (cached); manual smoke ~10s per scenario |

---

## Sampling Rate

- **After every task commit:** `pnpm build` (per-package Turbo affected-only)
- **After every plan wave:** `pnpm build && pnpm lint` workspace-wide
- **Before `/gsd-verify-work`:** Full build+lint green; manual smoke matrix (Telegram real send, forced-failure CB open + log inspection, 4xx-no-retry, idempotent-flag-retry)
- **Max feedback latency:** ~30s cached build

---

## Per-Task Verification Map

> Filled by planner per-task once PLAN.md exists.

| Req ID | Plan | Wave | Behavior | Test Type | Automated Command / Observable Signal | File Exists | Status |
|--------|------|------|----------|-----------|---------------------------------------|-------------|--------|
| HTTP-01 | TBD | TBD | `AbstractHttpClient` framework compiles, no `any` | typecheck | `pnpm build` green; adapter `extends AbstractHttpClient` | ❌ W0 | ⬜ pending |
| HTTP-01 | TBD | TBD | Default timeout enforced | runtime | Smoke @ blackhole `http://10.255.255.1` w/ `defaultTimeoutMs: 100` → `TimeoutError` ~150ms | ❌ end-phase | ⬜ pending |
| HTTP-01 | TBD | TBD | Per-call timeout override | runtime | `client.get('/x', { timeoutMs: 50 })` overrides default | ❌ end-phase | ⬜ pending |
| HTTP-01 | TBD | TBD | Logs include all 6 fields | log inspection | Pino JSON line with `api`, `method`, `url`, `duration_ms`, `status_code`, `correlationId` | runtime only | ⬜ pending |
| HTTP-02 | TBD | TBD | CB opens after 5 consecutive failures | runtime | Force 5 failures → 6th rejects with `CircuitOpenError` (no inner fn invoked) | ❌ end-phase | ⬜ pending |
| HTTP-02 | TBD | TBD | CB transitions logged | log inspection | `http.client.circuit` event with `transition: 'open'\|'halfOpen'\|'close'` | runtime | ⬜ pending |
| HTTP-03 | TBD | TBD | 3 adapters exist | audit | `find apps -path '*/clients/{telegram,appstorespy,cloud-functions}/*.client.ts'` → 3 files | ❌ W0 | ⬜ pending |
| HTTP-03 | TBD | TBD | Each consumer module imports only its adapter | audit | notifier→Telegram only; parser→AppStoreSpy only; sender→CloudFn only | ❌ W0 | ⬜ pending |
| HTTP-04 | TBD | TBD | CB not in gRPC | audit | `grep -r "opossum\|CircuitBreaker" packages/foundation/src/external/grpc` → 0 hits | automated | ⬜ pending |
| D-09 | TBD | TBD | 4xx not retried | runtime | Force 401 → exactly 1 attempt logged | ❌ end-phase | ⬜ pending |
| D-09 | TBD | TBD | 5xx retried 3 times | runtime | Force persistent 500 → 3 attempts with exp backoff | ❌ end-phase | ⬜ pending |
| D-10 | TBD | TBD | POST not retried by default | runtime | Force 500 on POST → exactly 1 attempt | ❌ end-phase | ⬜ pending |
| D-10 | TBD | TBD | POST `idempotent: true` retries | runtime | `client.post('/x', body, { idempotent: true })` 500 → 3 attempts | ❌ end-phase | ⬜ pending |
| D-13 | TBD | TBD | External APIs not in /health/ready | audit | `grep -r "TELEGRAM\|APPSTORESPY\|CLOUDFN" apps/*/src/health/` → 0 hits | automated | ⬜ pending |
| D-16 | TBD | TBD | Body not logged | log inspection | `http.client.call` log line does not contain body strings | runtime, manual | ⬜ pending |
| D-19 | TBD | TBD | No Zod defaults | audit | `grep -r "\\.default(" packages/config/src/schemas/external-apis.ts` → 0 hits | automated | ⬜ pending |
| D-20 | TBD | TBD | Symbol.for() everywhere | audit | `grep "Symbol(" apps/*/src/infrastructure/clients/` → 0 (only Symbol.for) | automated | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Smoke endpoints scaffolded (pattern from Phase 22.3 storage smoke):
  - `apps/notifier/src/test/telegram-smoke.controller.ts`
  - `apps/parser/src/test/appstorespy-smoke.controller.ts`
  - `apps/sender/src/test/cloudfn-smoke.controller.ts`
- [ ] `.env.example` + `.env.docker` placeholders for 6 new env vars (TELEGRAM_BOT_TOKEN, TELEGRAM_BASE_URL, APPSTORESPY_API_KEY, APPSTORESPY_BASE_URL, CLOUDFN_API_KEY, CLOUDFN_BASE_URL)
- [ ] No Jest install — project charter defers

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Telegram real send | HTTP-03 / D-18 | Requires valid bot token + chat_id | Set env vars, hit smoke endpoint, verify message arrives |
| CB opens on persistent failure | HTTP-02 / D-12 | Requires forcing 5 consecutive failures | Point base URL at `http://10.255.255.1` (blackhole), call 5 times, check 6th = CircuitOpenError + log line |
| CB half-open transition | HTTP-02 / D-12 | Requires waiting 30s | After CB opens, wait 30s, verify next call attempts (halfOpen log) |
| Idempotency-aware retry | D-10 | Requires forcing 500 + comparing GET vs POST attempt counts | Smoke endpoint mirrors POST 500; verify exactly 1 attempt; same with `idempotent: true` flag → 3 attempts |
| Body not in logs | D-16 | Visual inspection | After call with sensitive body, grep logs for body content — should be absent |
| CorrelationId propagation | D-15 | CLS context | Hit smoke through gateway → notifier; verify same correlationId in both gateway and notifier logs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or end-of-phase typecheck-probe / smoke dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] End-of-phase smoke covers all MISSING runtime references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (cached build)
- [ ] `nyquist_compliant: true` set in frontmatter once planner fills task IDs

**Approval:** pending
