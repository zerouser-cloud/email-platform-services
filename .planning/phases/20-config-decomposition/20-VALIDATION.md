---
phase: 20
slug: config-decomposition
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-08
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | No test framework (tests out of scope per CLAUDE.md) |
| **Config file** | N/A |
| **Quick run command** | `pnpm --filter @email-platform/config build` |
| **Full suite command** | `pnpm build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @email-platform/config build`
- **After every plan wave:** Run `pnpm build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 1 | CFG-01 | — | N/A | build | `pnpm --filter @email-platform/config build` | N/A | ⬜ pending |
| 20-01-02 | 01 | 1 | CFG-02, CFG-04 | T-20-01 | Zod parse validates all env vars at boot | build | `pnpm build` | N/A | ⬜ pending |
| 20-02-01 | 02 | 2 | CFG-03 | — | N/A | build | `pnpm build` | N/A | ⬜ pending |
| 20-02-02 | 02 | 2 | CFG-03 | — | N/A | build | `pnpm build` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework setup needed — validation is build-level (`pnpm build` compiles all TypeScript and verifies type safety).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Per-service env isolation | CFG-03 | Requires running services with partial env | Start a service with only its required env vars, verify it boots. Start without a required var, verify it fails. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-08
