# Phase 16: CI Pipeline - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

GitHub Actions workflow that validates every PR to protected branches (dev, main) with lint, typecheck, and build checks. Turbo affected-only execution and remote cache for fast feedback. Husky pre-push hooks for local validation. Branch protection rules to enforce PR-only merges.

</domain>

<decisions>
## Implementation Decisions

### Branching Strategy
- **D-01:** Two protected branches: `dev` (working branch) and `main` (production). Feature branches merge into `dev` via PR, `dev` merges into `main` via PR.
- **D-02:** Branch protection rules on both `dev` and `main`: merge only through PR, CI checks required to pass, no direct push allowed.
- **D-03:** Include branch protection setup instructions or `gh api` script as part of the phase deliverable.

### CI Triggers
- **D-04:** GitHub Actions workflow triggers on PR to `dev` and `main` branches (opened, synchronize, reopened).
- **D-05:** Concurrency group per PR — new push cancels in-progress CI run for the same PR.

### CI Steps & Parallelization
- **D-06:** Three parallel jobs: `lint`, `typecheck`, `build`. All must pass for PR merge. Developer sees all problems at once, not one at a time.
- **D-07:** Proto generation runs in CI via `pnpm generate:contracts` (Turbo `generate` task). Generated code is NOT committed to git — Turbo cache handles repeated runs.
- **D-08:** Each job: checkout → setup Node 20 → pnpm install (cached) → turbo run {task} with affected filter.

### Turbo Configuration
- **D-09:** Affected-only execution via `turbo run {task} --filter=...[origin/dev]` (or `origin/main` depending on target branch). Only changed packages are checked.
- **D-10:** Remote cache via GitHub Actions cache backend (`actions/cache` for Turbo cache directory). No external services needed.
- **D-11:** Remove `NODE_ENV` from `globalEnv` in `turbo.json` — it was removed from env files in Phase 15 and should not affect cache keys.

### Local Hooks
- **D-12:** Husky pre-push hook: runs `turbo run lint typecheck` before push. Fast local feedback, but can be bypassed with `--no-verify` — CI is the real gate.

### Environment in CI
- **D-13:** No `.env` file in CI. Lint, typecheck, and build are compile-time operations that don't start the application. Zod validation runs at app startup (main.ts), not at build time. Clean 12-Factor: the build artifact is environment-agnostic.
- **D-14:** When integration tests are added later, GitHub Secrets will provide env vars for the test job only.

### Claude's Discretion
- Exact GitHub Actions workflow file structure (single file vs split)
- pnpm store caching strategy in GitHub Actions
- Whether to add a `ci` script to root package.json
- Husky setup details (which hook runner, lint-staged vs full run)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Turbo configuration
- `turbo.json` -- Current task graph (generate, build, lint, typecheck, dev, start). globalEnv has NODE_ENV to remove.
- `package.json` -- Root scripts: build, lint, typecheck, generate:contracts
- `pnpm-workspace.yaml` -- Workspace definition (apps/*, packages/*)

### Docker & build
- `infra/docker/app.Dockerfile` -- Dockerfile sets NODE_ENV=production for build optimization (not app behavior)

### Config validation
- `packages/config/src/env-schema.ts` -- Zod schema validates env at runtime (not build time)
- `packages/config/src/config-loader.ts` -- loadGlobalConfig() called in main.ts only

### Proto generation
- `packages/contracts/scripts/generate.sh` -- Proto generation script used by generate:contracts
- `packages/contracts/` -- Proto definitions and generated TypeScript

### Skills
- `.agents/skills/twelve-factor/SKILL.md` -- No env branching, config from env at runtime only
- `.agents/skills/infrastructure-guard/SKILL.md` -- Port and infra change protocol

### Prior phase context
- `.planning/phases/15-docker-compose-split-environment/15-CONTEXT.md` -- Phase 15 decisions (NODE_ENV removal, env sync, compose split)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `turbo.json` already has `lint`, `typecheck`, `build`, `generate` tasks with proper dependency graph
- Root `package.json` has `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm generate:contracts` scripts
- `pnpm-workspace.yaml` defines workspace structure for Turbo to discover packages

### Established Patterns
- Turbo `generate` task has inputs/outputs defined for caching: `proto/**/*.proto` -> `src/generated/**`
- `build` depends on `^build` and `generate` — dependency chain is correct
- `typecheck` depends on `^build` — types require compiled dependencies

### Integration Points
- `turbo.json` `globalEnv` needs NODE_ENV removed
- `.github/workflows/` directory needs to be created (doesn't exist yet)
- `package.json` may need Husky devDependency and prepare script
- `.husky/` directory needs to be created for git hooks

</code_context>

<specifics>
## Specific Ideas

- Branch protection должен быть настроен как часть фазы — либо инструкция, либо скрипт через `gh api`
- CI должен работать на чистом клоне без ручных настроек (requirement CI-01 SC4)
- Подход к проверкам: локальные хуки — convenience, CI — enforcement. Разработчик может обойти хуки, но не CI.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 16-ci-pipeline*
*Context gathered: 2026-04-04*
