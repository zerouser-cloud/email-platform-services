---
phase: 18-deployment-via-coolify
plan: 01
subsystem: infra
tags: [docker-compose, coolify, ghcr, github-actions, env-schema, zod, storage]

requires:
  - phase: 17-docker-image-build-push
    provides: GHA workflow building and pushing per-service images to GHCR
provides:
  - Storage-agnostic STORAGE_* env vars replacing MINIO_* in Zod schema
  - Production docker-compose.prod.yml with 6 services pulling from GHCR
  - Coolify webhook deploy step in GHA workflow
affects: [coolify-setup, deployment, env-configuration]

tech-stack:
  added: []
  patterns: [coolify-compatible-compose, storage-agnostic-env-naming]

key-files:
  created:
    - docker-compose.prod.yml
  modified:
    - packages/config/src/infrastructure.ts
    - .env.docker
    - .env.example
    - .github/workflows/docker-build.yml

key-decisions:
  - "STORAGE_* prefix chosen over S3_* for storage-agnostic naming (works with MinIO, Garage, S3)"
  - "docker-compose.prod.yml has no networks/env_file/build directives per Coolify best practices"
  - "Deploy job only triggers on main branch push (not dev)"

patterns-established:
  - "Coolify compose pattern: image-only, no networks, no env_file, Coolify injects vars"

requirements-completed: [DPLY-01, DPLY-03, DPLY-04]

duration: 3min
completed: 2026-04-05
---

# Phase 18 Plan 01: Deployment Prep Summary

**MINIO_* renamed to STORAGE_* in env schema, production compose with 6 GHCR services, Coolify webhook deploy step in GHA**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-05T08:11:12Z
- **Completed:** 2026-04-05T08:14:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Renamed MINIO_* to STORAGE_* in Zod schema and all env files for storage-agnostic naming
- Added STORAGE_BUCKET and STORAGE_REGION as new required fields
- Created docker-compose.prod.yml with 6 services pulling pre-built images from GHCR
- Added deploy job to GHA workflow triggering Coolify webhook after successful build on main

## Task Commits

Each task was committed atomically:

1. **Task 1: Rename MINIO env vars to STORAGE and update all env files** - `55d78ea` (feat)
2. **Task 2: Create docker-compose.prod.yml and add GHA deploy step** - `a74fb1d` (feat)

## Files Created/Modified
- `packages/config/src/infrastructure.ts` - Storage-agnostic Zod schema with STORAGE_* fields
- `.env.docker` - Updated env vars from MINIO_* to STORAGE_*, added BUCKET/REGION
- `.env.example` - Updated env vars from MINIO_* to STORAGE_*, added BUCKET/REGION
- `docker-compose.prod.yml` - Production compose for Coolify (6 services, GHCR images, no networks/build/env_file)
- `.github/workflows/docker-build.yml` - Added deploy job triggering Coolify webhook on main branch

## Decisions Made
- STORAGE_* prefix chosen over S3_* for storage-agnostic naming (works with MinIO, Garage, S3)
- docker-compose.prod.yml follows Coolify anti-pattern avoidance: no networks, no env_file, no build directives
- Deploy job restricted to main branch only (dev branch builds but does not deploy)

## Deviations from Plan

None - plan executed exactly as written.

Note: `.env` file is gitignored and not tracked. Only `.env.docker` and `.env.example` were updated (2 tracked env files instead of 3). The user's local `.env` will need manual update.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Coolify secrets (COOLIFY_WEBHOOK, COOLIFY_TOKEN) need to be set in GitHub repository secrets before deploy job will work.

## Next Phase Readiness
- Production compose and GHA deploy step ready
- Coolify resource configuration (Plan 02) can proceed
- User needs to add COOLIFY_WEBHOOK and COOLIFY_TOKEN to GitHub repo secrets

---
*Phase: 18-deployment-via-coolify*
*Completed: 2026-04-05*
