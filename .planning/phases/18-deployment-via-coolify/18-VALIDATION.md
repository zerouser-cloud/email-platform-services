---
phase: 18
slug: deployment-via-coolify
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification (deployment phase) + smoke tests |
| **Config file** | none |
| **Quick run command** | `curl -s https://api.dev.email-platform.pp.ua/health/live` |
| **Full suite command** | `curl -s https://api.dev.email-platform.pp.ua/health/ready && curl -s https://api.email-platform.pp.ua/health/ready` |
| **Estimated runtime** | ~5 seconds (network) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm turbo run build` (for code changes)
- **After every plan wave:** Smoke test health endpoints
- **Before `/gsd:verify-work`:** Full suite (both envs)
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | DPLY-04 | grep+build | `grep STORAGE_ENDPOINT packages/config/src/infrastructure.ts && pnpm turbo run build` | ✅ | ⬜ pending |
| 18-01-02 | 01 | 1 | DPLY-01 | config | `docker compose -f infra/docker-compose.prod.yml config --quiet` | ❌ W0 | ⬜ pending |
| 18-02-01 | 02 | 1 | DPLY-01 | manual | Coolify UI: verify project + environments exist | N/A | ⬜ pending |
| 18-02-02 | 02 | 1 | DPLY-01 | manual | Coolify UI: verify infra resources running | N/A | ⬜ pending |
| 18-03-01 | 03 | 2 | DPLY-02 | smoke | `curl -s https://api.dev.email-platform.pp.ua/health/live` | N/A | ⬜ pending |
| 18-03-02 | 03 | 2 | DPLY-03 | smoke | `curl -s https://api.email-platform.pp.ua/health/ready` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `infra/docker-compose.prod.yml` — production compose file (created in Wave 1)

*Coolify resources are created manually via UI.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Coolify infra resources running | DPLY-01 | Coolify UI only | Check each resource (PostgreSQL, Redis, RabbitMQ, Garage) shows "Running" status |
| Auto-deploy on push | DPLY-01 | Requires git push + Coolify webhook | Push commit to dev branch, verify Coolify triggers deploy |
| TLS certificate active | DPLY-02 | Requires HTTPS request | `curl -vI https://api.email-platform.pp.ua` — verify TLS handshake |
| All services SERVING | DPLY-03 | Requires live deployment | `curl https://api.email-platform.pp.ua/health/ready` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
