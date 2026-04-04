---
phase: 16
slug: ci-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-04
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Shell verification (no test framework needed — CI config is validated by running the pipeline) |
| **Config file** | `.github/workflows/ci.yml` |
| **Quick run command** | `turbo run lint typecheck build --dry-run` |
| **Full suite command** | `turbo run lint typecheck build` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `turbo run lint typecheck build --dry-run`
- **After every plan wave:** Run `turbo run lint typecheck build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | CI-01 | config | `test -f .github/workflows/ci.yml` | ❌ W0 | ⬜ pending |
| 16-01-02 | 01 | 1 | CI-01 | config | `grep 'pull_request' .github/workflows/ci.yml` | ❌ W0 | ⬜ pending |
| 16-01-03 | 01 | 1 | CI-02 | config | `grep 'affected\|filter' .github/workflows/ci.yml` | ❌ W0 | ⬜ pending |
| 16-01-04 | 01 | 1 | CI-03 | config | `grep 'actions/cache' .github/workflows/ci.yml` | ❌ W0 | ⬜ pending |
| 16-01-05 | 01 | 1 | CI-01 | build | `turbo run lint typecheck build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `.github/workflows/ci.yml` — CI workflow file (created during execution)
- [ ] `turbo run lint typecheck build` passes on current codebase

*Existing Turbo infrastructure covers build/lint/typecheck requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PR triggers CI | CI-01 | Requires actual GitHub PR | Push branch, open PR, verify Actions tab shows workflow running |
| Turbo cache hit on second run | CI-03 | Requires two CI runs | Push two commits to same PR, verify second run shows cache hits in log |
| Branch protection blocks merge | CI-01 | GitHub settings | Open PR with failing CI, verify merge button is disabled |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
