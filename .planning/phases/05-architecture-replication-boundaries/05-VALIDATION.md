---
phase: 5
slug: architecture-replication-boundaries
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 5 — Validation Strategy

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Shell commands + grep + architecture-validator |
| **Quick run command** | `pnpm turbo build` |
| **Full suite command** | `pnpm turbo build && docker compose -f infra/docker-compose.yml up -d && sleep 5 && curl -s http://localhost:4000/health/ready` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task:** Quick build
- **After every plan wave:** Full build + architecture validation
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command |
|---------|------|------|-------------|-----------|-------------------|
| 5-xx-01 | per-svc | 1-3 | ARCH-02 | grep | `! grep -r "@nestjs" apps/{svc}/src/domain/` |
| 5-xx-02 | per-svc | 1-3 | CONT-04 | grep | `grep -q "ServiceControllerMethods" apps/{svc}/src/infrastructure/grpc/` |
| 5-xx-03 | all | final | ARCH-02 | grep | `! grep -rE "from.*apps/(auth\|sender\|parser\|audience\|notifier\|gateway)/src" apps/*/src/` |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual |
|----------|-------------|------------|
| Docker compose all services healthy | ARCH-03 | Requires running infrastructure |

---

## Validation Sign-Off

- [ ] All tasks have automated verify
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
