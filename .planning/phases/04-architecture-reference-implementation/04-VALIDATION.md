---
phase: 4
slug: architecture-reference-implementation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Shell commands + grep + architecture-validator agent |
| **Config file** | none |
| **Quick run command** | `pnpm turbo build --filter=@email-platform/auth` |
| **Full suite command** | `pnpm turbo build` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick build + grep validation
- **After every plan wave:** Run architecture-validator agent
- **Before `/gsd:verify-work`:** Full build + docker health check
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | ARCH-01 | grep | `test -d apps/auth/src/domain && test -d apps/auth/src/application && test -d apps/auth/src/infrastructure` | ✅ | ⬜ pending |
| 4-01-02 | 01 | 1 | ARCH-01 | grep | `! grep -r "@nestjs" apps/auth/src/domain/` | ✅ | ⬜ pending |
| 4-02-01 | 02 | 2 | ARCH-01 | cli | `pnpm turbo build --filter=@email-platform/auth` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Architecture-validator passes | ARCH-01 | Requires agent invocation | Run architecture-validator on apps/auth |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
