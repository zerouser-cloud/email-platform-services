---
phase: quick
plan: 260406-oes
subsystem: infra
tags: [coolify, ci-cd, github-actions, deploy]

requires:
  - phase: 18.1-deployment-polish
    provides: Docker build workflow, production compose
provides:
  - Composite GitHub Action for Coolify API deploy
  - CI deploy job triggered after image build
  - Branch-based routing (dev/prod UUID)
affects: [deployment, ci-cd]

tech-stack:
  added: []
  patterns: [composite-action-for-deploy, push-based-deploy]

key-files:
  created:
    - .github/actions/coolify-deploy/action.yml
  modified:
    - .github/workflows/docker-build.yml

key-decisions:
  - "Push-based deploy via Coolify API replaces Diun pull-based polling"
  - "Single composite action reused by deploy job with branch-conditional UUID"

patterns-established:
  - "Coolify deploy pattern: composite action with token/host/uuid inputs"

requirements-completed: []

duration: 2min
completed: 2026-04-06
---

# Quick Task 260406-oes: Replace Diun with CI Push-Based Coolify Deploy

**Push-based Coolify deploy via composite GitHub Action triggered after CI image build, with branch-based dev/prod UUID routing**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-06T14:37:02Z
- **Completed:** 2026-04-06T14:39:00Z
- **Tasks:** 2 (1 pre-satisfied, 1 executed)
- **Files modified:** 2

## Accomplishments
- Created reusable composite action `.github/actions/coolify-deploy/action.yml` wrapping Coolify deploy API
- Added deploy job to CI workflow that runs after all matrix builds complete
- Branch-based UUID routing: dev branch deploys to dev Coolify app, main to prod
- All credentials sourced from GitHub secrets (COOLIFY_TOKEN, COOLIFY_HOST, COOLIFY_UUID_DEV, COOLIFY_UUID_PROD)

## Task Commits

1. **Task 1: Remove Diun artifacts** - pre-satisfied (Diun labels already removed in commit afbcc61, deploy-router.sh already deleted)
2. **Task 2: Create composite action and deploy job** - `b099435` (feat)

## Files Created/Modified
- `.github/actions/coolify-deploy/action.yml` - Reusable composite action calling Coolify deploy API
- `.github/workflows/docker-build.yml` - Added deploy job with needs: [build-and-push]

## Decisions Made
- Task 1 was already satisfied by previous commits (afbcc61 removed Diun labels) -- no redundant changes made

## Deviations from Plan

None - plan executed as written. Task 1 was pre-satisfied from earlier work.

## Issues Encountered
None

## User Setup Required

GitHub repository secrets must be configured:
- `COOLIFY_TOKEN` - Coolify API bearer token
- `COOLIFY_HOST` - Coolify instance URL (e.g., https://coolify.example.com)
- `COOLIFY_UUID_DEV` - Coolify application UUID for dev environment
- `COOLIFY_UUID_PROD` - Coolify application UUID for production environment

## Next Phase Readiness
- CI pipeline complete: build -> push -> deploy
- Secrets need to be configured in GitHub repository settings

---
*Quick task: 260406-oes*
*Completed: 2026-04-06*
