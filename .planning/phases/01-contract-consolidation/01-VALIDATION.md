---
phase: 1
slug: contract-consolidation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Shell commands (no test framework — infrastructure phase) |
| **Config file** | none — validation via CLI commands |
| **Quick run command** | `pnpm generate:contracts && pnpm turbo build --filter=@email-platform/contracts` |
| **Full suite command** | `pnpm turbo build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick build command
- **After every plan wave:** Run full turbo build
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | CONT-01 | cli | `test ! -d packages/contracts/generated` | ✅ | ⬜ pending |
| 1-01-02 | 01 | 1 | CONT-01 | cli | `ls packages/contracts/src/generated/*.ts` | ✅ | ⬜ pending |
| 1-02-01 | 02 | 1 | CONT-02 | cli | `pnpm turbo build --filter=@email-platform/contracts --dry` | ✅ | ⬜ pending |
| 1-02-02 | 02 | 1 | CONT-03 | cli | `pnpm generate:contracts` | ✅ | ⬜ pending |
| 1-03-01 | 03 | 1 | CONT-01 | cli | `pnpm turbo build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework needed for this infrastructure phase.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Import paths resolve | CONT-01 | Requires TypeScript compilation | Run `pnpm turbo build` and verify no import errors |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
