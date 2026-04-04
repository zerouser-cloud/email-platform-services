# Phase 16: CI Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-04
**Phase:** 16-ci-pipeline
**Areas discussed:** Triggers & branches, Turbo filtering & cache, CI steps & order, Secrets & environment

---

## Triggers & Branches

### Branching strategy

| Option | Description | Selected |
|--------|-------------|----------|
| main + dev (recommended) | dev = working branch, main = production. CI on PR to both. Branch protection on both. | |
| Only main | One protected branch. Simpler, no staging. | |
| main + dev + staging | Three levels, full gitflow. Overkill for small team. | |
| Other (user input) | User specified: dev + main with full branch protection rules | ✓ |

**User's choice:** dev + main with protected branches. "Нужно сделать полноценно, как ты описал с protected branches. Ветки сделаем как нужно, dev будет dev, а main будет prod."
**Notes:** User wants branch protection configured as part of this phase, not deferred.

### Pre-push hooks

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, via Husky (recommended) | Fast local feedback. Can bypass with --no-verify, CI catches anyway. | ✓ |
| No, CI only | Checks only on GitHub. Simpler but slower feedback. | |

**User's choice:** Husky pre-push hooks

---

## Turbo: Filtering & Cache

### Remote cache backend

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub Actions cache (recommended) | Free, built into GH Actions. No external dependencies. | ✓ |
| Vercel Remote Cache | Official Turbo cache. Requires Vercel account + TURBO_TOKEN. | |
| Self-hosted | Full control but needs server. Overkill for this scale. | |

**User's choice:** GitHub Actions cache

### Affected packages detection

| Option | Description | Selected |
|--------|-------------|----------|
| turbo --filter=...[base] (recommended) | Turbo detects changed packages via git diff against base branch. | ✓ |
| Always all | Turbo checks all packages, cache skips unchanged. Simpler but slower. | |

**User's choice:** turbo --filter=...[base]

---

## CI Steps & Order

### Execution strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Parallel (recommended) | lint, typecheck, build as separate parallel jobs. See all problems at once. | ✓ |
| Turbo decides | Single `turbo run lint typecheck build`. One command, one job. | |
| Sequential | lint -> typecheck -> build in order. Stop on first error. | |

**User's choice:** Parallel jobs
**Notes:** User confirmed: even if some checks pass while others fail, PR is still blocked. This is a feature -- see all issues at once.

### Proto generation

| Option | Description | Selected |
|--------|-------------|----------|
| Generate in CI (recommended) | CI runs generate:contracts. Generated code not in git. Turbo caches result. | ✓ |
| Commit generated | Generated files in repo. CI skips generate. Risk of proto/generated drift. | |

**User's choice:** Generate in CI

---

## Secrets & Environment

### Env handling in CI

| Option | Description | Selected |
|--------|-------------|----------|
| No env (recommended) | CI doesn't need env: lint/typecheck/build don't start the app. Clean 12-Factor. | ✓ |
| Minimal .env.ci | Stub values in repo. Insurance, but masks problems. | |
| GitHub Secrets | Env via GitHub Secrets. Overkill when no real connections needed. | |

**User's choice:** No env in CI
**Notes:** Discussed 12-Factor principles extensively. User asked about the twelve-factor skill. Key insight: Zod validation runs at app startup (main.ts), not at compile time. Build artifact is environment-agnostic. GitHub Secrets will be added later when integration tests need real DB connections.

---

## Claude's Discretion

- Exact GitHub Actions workflow file structure
- pnpm store caching strategy
- Husky setup details
- Whether to add ci convenience script

## Deferred Ideas

None -- discussion stayed within phase scope.
