---
status: active
created: 2026-05-02
purpose: Centralised registry of outstanding UAT/VERIFICATION items deferred from completed phases. Each entry has explicit trigger conditions for return.
maintained_by: orchestrator (auto-update on phase close)
---

# UAT Backlog — Outstanding Manual Verification Items

This file tracks all `partial` / `human_needed` UAT and VERIFICATION items across closed phases.
Items are **formally deferred** with trigger conditions — not lost, not silently pending.

## Why this file exists

Without this registry, partial UAT files accumulate as silent debt across phase boundaries.
Each entry below represents work that:

1. Is required for full phase closure
2. Was not blocking execution at the time
3. Has an explicit trigger condition for re-evaluation

When a trigger fires (e.g., "before merging milestone v4.0 to main"), revisit the entry,
run the manual verification, and update the source phase file's status to `passed`.

## Outstanding Items

### Phase 20 — config-decomposition

- **File:** `.planning/phases/20-config-decomposition/20-VERIFICATION.md`
- **Status:** `human_needed`
- **Items:** 1 — minimal-env service boot smoke
- **Trigger:** Before milestone v4.0 → main merge OR before adding any new env var
- **Effort:** ~10 min runtime check

### Phase 21 — redis-cachemodule

- **File:** `.planning/phases/21-redis-cachemodule/21-VERIFICATION.md`
- **Status:** `human_needed`
- **Items:** 2 — Redis health on sender + CACHE_SERVICE namespace prefix
- **Trigger:** Before milestone v4.0 → main merge OR before any Redis cache-key refactor
- **Effort:** ~15 min (requires running Redis)

### Phase 22 — s3-storagemodule

- **Files:**
  - `.planning/phases/22-s3-storagemodule/22-HUMAN-UAT.md` (status: `partial`)
  - `.planning/phases/22-s3-storagemodule/22-VERIFICATION.md` (status: `human_needed`, duplicate)
- **Items:** 4
  - Parser readiness against local MinIO (per-bucket DI graph)
  - Notifier readiness against local MinIO (CR-02 fix verification)
  - MinIO → Garage provider swap without code change
  - SIGTERM graceful shutdown with single S3Client instance
- **Trigger:** Before milestone v4.0 → main merge (Storage stack acceptance)
- **Effort:** ~60-90 min (requires MinIO + Garage, runtime DI exercise)

### Phase 22.2 — bucket-provisioning-automation

- **Files:**
  - `.planning/phases/22.2-bucket-provisioning-automation/22.2-HUMAN-UAT.md` (status: `partial`)
  - `.planning/phases/22.2-bucket-provisioning-automation/22.2-VERIFICATION.md` (status: `human_needed`, duplicate)
- **Items:** 4
  - End-to-end read-through runbook
  - Visual scan of Garage warning blocks
  - Execute Local-native section on clean machine
  - Verify Garage key binding claim against live Garage
- **Trigger:** Before milestone v4.0 → main merge OR after any bucket-provisioning script change
- **Effort:** ~60 min (clean-machine reproduction + live Garage)

### Phase 22.3 — storage-smoke-test-endpoints

- **File:** `.planning/phases/22.3-storage-smoke-test-endpoints/22.3-VERIFICATION.md`
- **Status:** `human_needed`
- **Items:** 3 — gateway smoke endpoints (parser/notifier/cross-service)
- **Trigger:** Before milestone v4.0 → main merge
- **Effort:** ~15 min (gateway running + curl)

### Phase 999.10.1 — hexagonal-naming-convention-refactor

- **File:** `.planning/phases/999.10.1-hexagonal-naming-convention-refactor/999.10.1-VERIFICATION.md`
- **Status:** `human_needed`
- **Items:** 6 — docs read-through (CLAUDE.md / ARCHITECTURE.md / NAMING.md / EXAMPLES.md / DO-DONT.md / SKILL.md)
- **Trigger:** Before next major refactor that touches DI naming OR before milestone v4.0 → main merge
- **Effort:** ~10 min (no runtime, just docs read)

### Phase 999.17 — devsecops-shift-left-security-tooling

- **Files:**
  - `.planning/phases/999.17-devsecops-shift-left-security-tooling/999.17-HUMAN-UAT.md` (status: `partial`)
  - `.planning/phases/999.17-devsecops-shift-left-security-tooling/999.17-VERIFICATION.md` (status: `human_needed`, duplicate)
- **Items:** 2
  - DEVOPS-HANDOFF.md actionability (read-through by DevOps team representative)
  - Hook UX latency on a real developer machine (pre-commit + pre-push timings)
- **Trigger:** Before GitLab CI migration kickoff (handoff doc must be validated by recipient) OR if hook complaints surface from team
- **Effort:** ~15 min

### Phase 999.17.3 — vulnerability-remediation-direct-dep-upgrades

- **File:** `.planning/phases/999.17.3-vulnerability-remediation-direct-dep-upgrades/999.17.3-UAT.md`
- **Status:** `partial` (6 pending + 1 issue + 1 blocked)
- **Items:** 8
  - Cold start smoke (native + isolated)
  - pnpm audit residual matches Path A1
  - pnpm lint on ESLint v9 flat config
  - pnpm build after dep upgrades
  - pnpm install idempotence (D-12)
  - No bypass mechanisms in repo
  - ts-node-dev fully removed (D-03)
  - Sub-phase merge readiness
- **Trigger:** **Awaiting downstream — closure of phase 999.18** (Issue #2 fix in Plan 03 unlocks remaining items)
- **Effort:** ~30 min runtime smoke after 999.18 lands
- **NOT a forgotten debt** — this is structurally awaiting 999.18 fix waves.

## Summary

- **Total outstanding files:** 11 (7 unique work scopes + 4 VERIFICATION duplicates auto-closed by HUMAN-UAT)
- **Total outstanding test items:** ~22+
- **Total estimated effort to close:** ~3-4 hours of manual runtime verification across 7 work scopes

## Process

When picking up an item:

1. Open the source UAT/VERIFICATION file
2. Run the listed manual checks
3. Update `result:` per item, then `status:` to `passed` (or `gaps_found` if issues surface)
4. Remove the entry from this file
5. Commit as `docs(uat): close <phase> outstanding items`

When **adding** a new entry (after a future phase ends with `human_needed`):

1. Append entry following the structure above
2. Set explicit trigger condition (not "later")
3. Estimate effort honestly

This file is **read by orchestrators before starting new phases** — accumulating entries
without triggers eventually becomes blocking, forcing closure prioritisation.
