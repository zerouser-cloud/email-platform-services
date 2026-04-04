# Phase 16: CI Pipeline - Research

**Researched:** 2026-04-04
**Domain:** GitHub Actions CI, Turborepo, pnpm monorepo, Husky git hooks
**Confidence:** HIGH

## Summary

Phase 16 implements a GitHub Actions CI pipeline for a pnpm + Turborepo monorepo with 6 NestJS microservices and 3 shared packages. The pipeline validates lint, typecheck, and build on every PR to `dev` and `main` branches. Turbo's `--affected` flag automatically detects changed packages using `GITHUB_BASE_REF` in PR context, so only modified packages are checked. Turbo's local `.turbo` cache directory is persisted between CI runs via `actions/cache@v4`.

The secondary deliverable is Husky pre-push hooks for local developer feedback and branch protection setup instructions via `gh api`. The key 12-Factor constraint is that no `.env` file is needed in CI -- lint, typecheck, and build are compile-time operations that never start the application.

**Primary recommendation:** Use `--affected` flag (not `--filter`) for automatic base branch detection in PR context, `actions/cache@v4` for Turbo cache persistence, and three parallel jobs for lint/typecheck/build.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Two protected branches: `dev` (working branch) and `main` (production). Feature branches merge into `dev` via PR, `dev` merges into `main` via PR.
- **D-02:** Branch protection rules on both `dev` and `main`: merge only through PR, CI checks required to pass, no direct push allowed.
- **D-03:** Include branch protection setup instructions or `gh api` script as part of the phase deliverable.
- **D-04:** GitHub Actions workflow triggers on PR to `dev` and `main` branches (opened, synchronize, reopened).
- **D-05:** Concurrency group per PR -- new push cancels in-progress CI run for the same PR.
- **D-06:** Three parallel jobs: `lint`, `typecheck`, `build`. All must pass for PR merge. Developer sees all problems at once, not one at a time.
- **D-07:** Proto generation runs in CI via `pnpm generate:contracts` (Turbo `generate` task). Generated code is NOT committed to git -- Turbo cache handles repeated runs.
- **D-08:** Each job: checkout -> setup Node 20 -> pnpm install (cached) -> turbo run {task} with affected filter.
- **D-09:** Affected-only execution via `turbo run {task} --filter=...[origin/dev]` (or `origin/main` depending on target branch). Only changed packages are checked.
- **D-10:** Remote cache via GitHub Actions cache backend (`actions/cache` for Turbo cache directory). No external services needed.
- **D-11:** Remove `NODE_ENV` from `globalEnv` in `turbo.json` -- it was removed from env files in Phase 15 and should not affect cache keys.
- **D-12:** Husky pre-push hook: runs `turbo run lint typecheck` before push. Fast local feedback, but can be bypassed with `--no-verify` -- CI is the real gate.
- **D-13:** No `.env` file in CI. Lint, typecheck, and build are compile-time operations that don't start the application. Zod validation runs at app startup (main.ts), not at build time. Clean 12-Factor: the build artifact is environment-agnostic.
- **D-14:** When integration tests are added later, GitHub Secrets will provide env vars for the test job only.

### Claude's Discretion
- Exact GitHub Actions workflow file structure (single file vs split)
- pnpm store caching strategy in GitHub Actions
- Whether to add a `ci` script to root package.json
- Husky setup details (which hook runner, lint-staged vs full run)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CI-01 | GitHub Actions workflow: lint + typecheck + build on every PR | Three parallel jobs with shared setup steps, concurrency groups for PR cancellation |
| CI-02 | Turbo affected-only execution -- CI runs only changed packages | `--affected` flag with `TURBO_SCM_BASE` env var set from `github.base_ref` |
| CI-03 | Turbo remote cache via GitHub Actions cache | `actions/cache@v4` persisting `.turbo` directory between runs |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| turbo | 2.8.14 (installed) | Monorepo task runner with caching | Already in project, `--affected` flag for CI |
| pnpm | 9.0.0 (pinned in packageManager) | Package manager | Already in project, `action-setup` has native GHA support |
| husky | 9.1.7 | Git hooks manager | De facto standard, minimal config for v9 |

### GitHub Actions
| Action | Version | Purpose | Why Standard |
|--------|---------|---------|--------------|
| actions/checkout@v4 | v4 | Git checkout with full history | Required for `--affected` to detect changes |
| pnpm/action-setup@v4 | v4 | Install pnpm | Reads `packageManager` field from package.json |
| actions/setup-node@v4 | v4 | Install Node.js + cache pnpm store | Built-in `cache: 'pnpm'` support |
| actions/cache@v4 | v4 | Persist Turbo cache between runs | Simple key/restore-keys strategy |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `actions/cache` for Turbo | `rharkor/caching-for-turbo` | Spins up local cache server, more complex -- overkill for this project. `actions/cache` is simpler and sufficient. |
| `--affected` flag | `--filter=...[origin/dev]` | `--affected` auto-detects base branch via `GITHUB_BASE_REF`. But user decision D-09 specifies `--filter` syntax. Recommendation: use `--affected` with `TURBO_SCM_BASE` override. See Architecture Patterns for resolution. |
| Husky pre-push | lint-staged pre-commit | Pre-push runs on full changed set, not just staged files. Matches D-12. |

**Installation:**
```bash
pnpm add -D -w husky
```

## Architecture Patterns

### Recommended Workflow Structure
Single workflow file with three parallel jobs and a shared setup pattern via composite action or YAML anchors.

```
.github/
  workflows/
    ci.yml              # Single workflow: lint, typecheck, build
.husky/
  pre-push             # Turbo lint + typecheck
scripts/
  setup-branch-protection.sh   # gh api calls for branch protection
```

### Pattern 1: --affected vs --filter Resolution

**What:** D-09 specifies `--filter=...[origin/dev]` syntax, but Turbo's `--affected` flag is the modern equivalent that auto-detects the base branch in GitHub Actions PR context.

**Resolution:** Use `--affected` with `TURBO_SCM_BASE` set to `${{ github.base_ref }}`. This achieves the same result as D-09 but is cleaner:

```yaml
env:
  TURBO_SCM_BASE: ${{ github.base_ref }}

steps:
  - run: pnpm turbo run lint --affected
```

In a PR to `dev`, `github.base_ref` = `dev`. In a PR to `main`, `github.base_ref` = `main`. This satisfies the intent of D-09 without hardcoding branch names.

**Confidence:** HIGH -- verified in official Turbo docs. `--affected` defaults to `--filter=...[main...HEAD]` but `TURBO_SCM_BASE` overrides the base.

### Pattern 2: Parallel Jobs with Shared Setup

**What:** Three independent jobs that all perform the same setup (checkout, pnpm, node, install, turbo cache) then run one task.

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      # shared setup steps
      - run: pnpm turbo run lint --affected

  typecheck:
    runs-on: ubuntu-latest
    steps:
      # shared setup steps
      - run: pnpm turbo run typecheck --affected

  build:
    runs-on: ubuntu-latest
    steps:
      # shared setup steps
      - run: pnpm turbo run build --affected
```

**Why parallel:** Developer sees all failures at once. Lint failure does not block typecheck/build feedback.

### Pattern 3: Turbo Cache via actions/cache

**What:** Persist `.turbo` directory between CI runs so unchanged packages skip execution.

```yaml
- name: Cache Turbo
  uses: actions/cache@v4
  with:
    path: .turbo
    key: turbo-${{ runner.os }}-${{ github.sha }}
    restore-keys: |
      turbo-${{ runner.os }}-
```

**Key design:** SHA-based key means each commit gets a unique cache entry. `restore-keys` falls back to any previous cache for the same OS, so partial cache hits are common. Turbo handles staleness internally -- it hashes task inputs and ignores stale entries.

### Pattern 4: Concurrency Groups

```yaml
concurrency:
  group: ci-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
```

**What:** If a developer pushes again while CI is running, the old run is cancelled. Saves runner minutes.

### Pattern 5: Full Git History for --affected

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
```

**Critical:** `--affected` compares Git history between base and HEAD. Shallow clones (`fetch-depth: 1`, the default) cause ALL packages to appear changed, defeating the purpose. `fetch-depth: 0` fetches full history. Alternative: `--filter=blob:none` for a faster treeless clone, but `fetch-depth: 0` is simpler and sufficient for this repo size.

### Pattern 6: Husky v9 Setup

```bash
# Install
pnpm add -D -w husky

# Initialize (creates .husky/ and adds prepare script)
pnpm exec husky init

# Replace default pre-commit with pre-push
rm .husky/pre-commit
echo "pnpm turbo run lint typecheck" > .husky/pre-push
chmod +x .husky/pre-push
```

Husky v9 uses a `prepare` script: `"prepare": "husky"` in root package.json.

**CI consideration:** The `prepare` script runs on `pnpm install`. In CI, Husky detects it is running in CI and skips hook installation automatically (checks for `CI=true` env var which GitHub Actions sets).

### Anti-Patterns to Avoid
- **Shallow clone with --affected:** Causes all packages to be detected as changed. Always use `fetch-depth: 0`.
- **NODE_ENV in globalEnv:** Invalidates cache between CI (where NODE_ENV may differ) and local. D-11 correctly removes it.
- **Single sequential job:** Developer waits for lint to pass before seeing typecheck errors. Use parallel jobs.
- **Committing generated proto code:** Creates merge conflicts, bloats repo. D-07 correctly keeps generated code out of git.
- **Using `.env` in CI:** Violates 12-Factor. Build steps never start the app, so env vars are unnecessary.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| pnpm store caching | Custom cache logic | `actions/setup-node@v4` with `cache: 'pnpm'` | Handles store path detection, hash computation automatically |
| Turbo cache persistence | Manual artifact upload/download | `actions/cache@v4` with `.turbo` path | Simple key/restore-keys pattern, no server needed |
| Base branch detection | Script parsing `GITHUB_BASE_REF` | Turbo `--affected` + `TURBO_SCM_BASE` | Turbo handles the git diff internally |
| Git hooks | Custom `.git/hooks` scripts | Husky v9 | Manages hook installation, CI detection, cross-platform |
| Branch protection | Manual GitHub UI clicks | `gh api` script | Reproducible, version-controlled, scriptable |

## Common Pitfalls

### Pitfall 1: Shallow Clone Breaks --affected
**What goes wrong:** `--affected` sees all packages as changed, CI runs everything every time.
**Why it happens:** Default `actions/checkout@v4` uses `fetch-depth: 1` (shallow clone). Turbo cannot diff between base and HEAD without history.
**How to avoid:** Set `fetch-depth: 0` on checkout step.
**Warning signs:** CI time is always the same regardless of what changed.

### Pitfall 2: pnpm Store Path Mismatch
**What goes wrong:** pnpm install runs from scratch every time despite caching.
**Why it happens:** `actions/setup-node` cache for pnpm needs pnpm to be installed BEFORE setup-node runs (to detect store path).
**How to avoid:** Order: (1) `pnpm/action-setup`, (2) `actions/setup-node` with `cache: 'pnpm'`, (3) `pnpm install`.
**Warning signs:** "Cache not found" messages despite previous runs.

### Pitfall 3: typecheck Depends on build
**What goes wrong:** `typecheck` job fails because workspace packages are not built (no `dist/` with `.d.ts` files).
**Why it happens:** `turbo.json` defines `typecheck` depends on `^build` (upstream packages must be built first). But in parallel jobs, the build job is separate.
**How to avoid:** Turbo handles this internally -- `turbo run typecheck --affected` will first run `^build` for dependencies. The parallel jobs are independent CI jobs, but within each job Turbo respects the task graph.
**Warning signs:** "Cannot find module '@email-platform/foundation'" in typecheck job.

### Pitfall 4: Proto Generation in Parallel Jobs
**What goes wrong:** All three jobs need proto-generated TypeScript files. Without them, build and typecheck fail.
**Why it happens:** `build` depends on `generate` in turbo.json. `typecheck` depends on `^build` which depends on `generate`. But `lint` does not depend on `generate`.
**How to avoid:** Turbo handles this via the task graph. When running `turbo run build --affected`, Turbo automatically runs `generate` first. For `typecheck`, Turbo runs `^build` -> `generate` first. Lint needs no generated code (ESLint only checks source files).
**Warning signs:** Import errors for `@email-platform/contracts` generated files.

### Pitfall 5: grpc-tools Native Binary in CI
**What goes wrong:** `pnpm install` fails because `grpc-tools` cannot build native addon.
**Why it happens:** `grpc-tools` ships prebuilt binaries for major platforms. On `ubuntu-latest` it downloads the linux-x64 binary. This works. But if the runner architecture changes or the binary is missing, it tries to compile from source.
**How to avoid:** `grpc-tools` 1.12.4 has prebuilt binaries for linux-x64. No special setup needed on `ubuntu-latest`. The `onlyBuiltDependencies` in root `package.json` already lists `grpc-tools`.
**Warning signs:** Long install times with C++ compilation output.

### Pitfall 6: Husky Running in CI
**What goes wrong:** `pnpm install` triggers `prepare` script which tries to install Husky hooks in CI.
**Why it happens:** `prepare` lifecycle script runs on `pnpm install`.
**How to avoid:** Husky v9 detects `CI=true` environment variable (set by GitHub Actions) and skips hook installation. No special configuration needed.
**Warning signs:** "husky - Git hooks installed" message in CI logs (harmless but unexpected).

## Code Examples

### Complete CI Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [dev, main]
    types: [opened, synchronize, reopened]

concurrency:
  group: ci-${{ github.event.pull_request.number }}
  cancel-in-progress: true

env:
  TURBO_SCM_BASE: ${{ github.base_ref }}

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - uses: actions/cache@v4
        with:
          path: .turbo
          key: turbo-${{ runner.os }}-lint-${{ github.sha }}
          restore-keys: |
            turbo-${{ runner.os }}-lint-

      - run: pnpm turbo run lint --affected

  typecheck:
    name: Typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - uses: actions/cache@v4
        with:
          path: .turbo
          key: turbo-${{ runner.os }}-typecheck-${{ github.sha }}
          restore-keys: |
            turbo-${{ runner.os }}-typecheck-

      - run: pnpm turbo run typecheck --affected

  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - uses: actions/cache@v4
        with:
          path: .turbo
          key: turbo-${{ runner.os }}-build-${{ github.sha }}
          restore-keys: |
            turbo-${{ runner.os }}-build-

      - run: pnpm turbo run build --affected
```

### Branch Protection Script

```bash
#!/bin/bash
# scripts/setup-branch-protection.sh
# Usage: ./scripts/setup-branch-protection.sh <owner/repo>

set -eu

REPO="${1:?Usage: $0 <owner/repo>}"

for BRANCH in dev main; do
  echo "Setting protection for $BRANCH..."

  gh api \
    --method PUT \
    "repos/$REPO/branches/$BRANCH/protection" \
    --input - <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Lint", "Typecheck", "Build"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF

  echo "Done: $BRANCH"
done
```

### Husky Pre-Push Hook

```bash
#!/bin/sh
# .husky/pre-push
pnpm turbo run lint typecheck
```

### turbo.json After NODE_ENV Removal

```json
{
    "$schema": "https://turbo.build/schema.json",
    "tasks": {
        "generate": {
            "inputs": ["proto/**/*.proto", "scripts/generate.sh"],
            "outputs": ["src/generated/**"]
        },
        "build": {
            "dependsOn": ["^build", "generate"],
            "outputs": ["dist/**"]
        },
        "dev": {
            "cache": false,
            "persistent": true,
            "passThroughEnv": ["*"]
        },
        "lint": {
            "dependsOn": ["^lint"]
        },
        "typecheck": {
            "dependsOn": ["^build"]
        },
        "start": {
            "dependsOn": ["^build"],
            "cache": false,
            "persistent": true,
            "passThroughEnv": ["*"]
        }
    }
}
```

Note: `globalEnv` array removed entirely (was `["NODE_ENV"]`).

## Discretion Recommendations

### Single Workflow File (Recommended)
Use a single `.github/workflows/ci.yml` rather than split files. Three jobs in one file share `concurrency` and `env` configuration. Split files add complexity for no benefit at this scale.

### pnpm Store Caching Strategy (Recommended)
Use `actions/setup-node@v4` with `cache: 'pnpm'`. This automatically detects the pnpm store path and caches it. No custom cache logic needed. Requires `pnpm/action-setup` to run BEFORE `setup-node`.

### No `ci` Script in Root package.json
Not recommended. The workflow calls `pnpm turbo run {task} --affected` directly. A `ci` script would hide the `--affected` flag and make local vs CI behavior confusing. Keep CI logic in the workflow file.

### Husky Setup (Recommended)
Use Husky v9 with a pre-push hook (not pre-commit). No lint-staged -- the pre-push hook runs `pnpm turbo run lint typecheck` on the entire affected set. This matches D-12: fast local feedback, bypassable with `--no-verify`, CI is the real gate.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `--filter=...[origin/main]` | `--affected` + `TURBO_SCM_BASE` | Turbo 2.x | Cleaner syntax, auto-detects CI env |
| Vercel Remote Cache | `actions/cache@v4` for `.turbo` dir | 2024+ community pattern | No Vercel account needed, simpler |
| `husky install` (v8) | `husky` (v9, prepare script) | Husky 9.0 | Simpler init, auto CI detection |
| `pnpm/action-setup@v3` | `pnpm/action-setup@v4` | 2024 | Reads `packageManager` field from package.json |

## Open Questions

1. **Turbo cache key per job vs shared**
   - What we know: Each parallel job writes to `.turbo`. If all three jobs use the same cache key, only the first to finish saves its cache (GHA cache is immutable per key).
   - Recommendation: Use per-job cache keys (`turbo-${{ runner.os }}-lint-${{ github.sha }}`) with per-job restore keys. This ensures each job can write its cache independently.

2. **`fetch-depth: 0` performance on future large repos**
   - What we know: Current repo is small, full clone is fast. For large repos, `--filter=blob:none` avoids downloading file contents while keeping full commit graph.
   - Recommendation: Start with `fetch-depth: 0`. Revisit if clone time becomes a bottleneck.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | No test framework (project constraint: no tests in this phase) |
| Config file | N/A |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CI-01 | Workflow triggers on PR, runs lint+typecheck+build | manual-only | Push a test PR, verify GHA runs | N/A |
| CI-02 | Turbo runs only affected packages | manual-only | Push PR changing one package, verify others skipped | N/A |
| CI-03 | Turbo cache hits on second run | manual-only | Push to same PR twice, verify cache hit messages | N/A |

### Sampling Rate
- **Per task commit:** Verify YAML syntax with `actionlint` if available, otherwise manual review
- **Per wave merge:** Push test PR to verify pipeline
- **Phase gate:** Clean clone test -- fresh checkout, `pnpm install`, `pnpm turbo run lint typecheck build` succeeds

### Wave 0 Gaps
None -- CI validation is inherently manual (requires GitHub Actions runner). Local validation limited to YAML syntax checking.

## Sources

### Primary (HIGH confidence)
- [Turbo --affected docs](https://turborepo.dev/docs/reference/run#--affected) - --affected flag behavior, TURBO_SCM_BASE env var
- [Turbo GitHub Actions guide](https://turborepo.dev/docs/guides/ci-vendors/github-actions) - actions/cache pattern for .turbo directory
- [Turbo Constructing CI](https://turborepo.dev/docs/crafting-your-repository/constructing-ci) - CI best practices, shallow clone warning
- [pnpm CI docs](https://pnpm.io/continuous-integration) - pnpm/action-setup + setup-node cache pattern
- [Husky get started](https://typicode.github.io/husky/get-started.html) - v9 init command, prepare script

### Secondary (MEDIUM confidence)
- [pnpm/action-setup GitHub](https://github.com/pnpm/action-setup) - v4/v5 versions, packageManager field support
- [rharkor/caching-for-turbo](https://github.com/rharkor/caching-for-turbo) - Alternative caching approach (evaluated, not recommended)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All tools already in project or well-documented official actions
- Architecture: HIGH - Turbo docs provide exact patterns, verified --affected behavior
- Pitfalls: HIGH - Shallow clone and action ordering are well-documented gotchas

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable tooling, 30-day window)

## Project Constraints (from CLAUDE.md)

- **No environment branching:** CI workflow must not use `NODE_ENV` checks. Build artifact is environment-agnostic (12-Factor).
- **No infrastructure changes without approval:** Branch protection setup is a documented script, not auto-applied.
- **No tests:** Phase scope excludes testing. CI runs lint, typecheck, build only.
- **Tech stack fixed:** NestJS 11, TypeScript, gRPC, pnpm 9, Turbo 2.8.14.
- **No switch/case patterns:** Not applicable to YAML workflow files, but applies if any JS helper scripts are created.
- **Config via DI:** Not applicable -- CI does not start the application.
