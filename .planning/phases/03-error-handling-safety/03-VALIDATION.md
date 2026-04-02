---
phase: 3
slug: error-handling-safety
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Shell commands + grep (no test framework) |
| **Config file** | none |
| **Quick run command** | `pnpm turbo build --filter=@email-platform/foundation` |
| **Full suite command** | `pnpm turbo build` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick build command
- **After every plan wave:** Run full turbo build
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | ERR-01 | grep | `grep -q 'metadata.get(HEADER.CORRELATION_ID)?\.\[0\]' packages/foundation/src/logging/logging.module.ts` | ✅ | ⬜ pending |
| 3-01-02 | 01 | 1 | ERR-02 | grep | `grep -q 'ERROR_CODE_TO_MESSAGE' packages/foundation/src/errors/grpc-to-http.filter.ts` | ✅ | ⬜ pending |
| 3-02-01 | 02 | 2 | ERR-03 | grep | `grep -q 'correlationId' packages/foundation/src/errors/grpc-to-http.filter.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Error response shape via curl | ERR-03 | Requires running services | `docker compose up -d`, call invalid endpoint, verify JSON shape |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
