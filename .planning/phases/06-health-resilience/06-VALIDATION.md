---
phase: 6
slug: health-resilience
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 6 — Validation Strategy

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Shell commands + curl |
| **Quick run command** | `pnpm turbo build` |
| **Full suite command** | `pnpm turbo build && docker compose -f infra/docker-compose.yml up -d && sleep 5 && curl -s http://localhost:4000/health/ready` |
| **Estimated runtime** | ~15 seconds |

---

## Per-Task Verification Map

| Task ID | Plan | Requirement | Test Type | Automated Command |
|---------|------|-------------|-----------|-------------------|
| 6-01-01 | 01 | HLTH-02 | grep | `grep -q "maxRetries: 5" packages/foundation/src/resilience/retry-connect.ts` |
| 6-01-02 | 01 | HLTH-01 | grep | `grep -q "allSettled\|Promise.all" apps/gateway/src/health/health.controller.ts` |
| 6-02-01 | 02 | HLTH-03 | curl | Health endpoints respond correctly after docker compose |

---

## Validation Sign-Off

**Approval:** pending
