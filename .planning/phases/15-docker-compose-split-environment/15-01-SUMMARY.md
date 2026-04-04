---
phase: 15-docker-compose-split-environment
plan: 01
subsystem: infra
tags: [docker-compose, environment, 12-factor, cors, zod]

requires:
  - phase: 14-verification-documentation
    provides: Working single docker-compose with all services and PostgreSQL

provides:
  - Self-contained infra-only compose file (docker-compose.infra.yml) for local dev
  - Full-stack compose file with include directive for Docker-only mode
  - Synchronized env files (.env, .env.docker, .env.example) with matching key sets
  - CORS_STRICT boolean flag replacing NODE_ENV-based CORS validation
  - All infrastructure ports exposed for local development

affects: [phase-16-ci-pipeline, phase-19-verification]

tech-stack:
  added: []
  patterns: [docker-compose-include, cors-strict-flag, 12-factor-no-env-branching]

key-files:
  created:
    - infra/docker-compose.infra.yml
  modified:
    - infra/docker-compose.yml
    - .env.example
    - .gitignore
    - packages/config/src/env-schema.ts

key-decisions:
  - "CORS_STRICT boolean flag replaces NODE_ENV check in Zod refine -- 12-Factor compliant"
  - "PROTO_DIR is Docker-only (absent from .env, present in .env.docker and .env.example)"
  - "All infra ports hardcoded to standard values per infrastructure-guard skill"

patterns-established:
  - "docker-compose include: infra-only file is self-contained, full-stack includes it"
  - "env file sync: same keys everywhere, PROTO_DIR is the one documented Docker-only exception"

requirements-completed: [DOCK-01, DOCK-02, DOCK-03, DOCK-04]

duration: 3min
completed: 2026-04-04
---

# Phase 15 Plan 01: Docker Compose Split & Environment Summary

**Split docker-compose into infra-only and full-stack files with include directive, synced env files, and CORS_STRICT flag replacing NODE_ENV**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-04T13:41:11Z
- **Completed:** 2026-04-04T13:43:49Z
- **Tasks:** 2 auto + 1 human checkpoint (documented below)
- **Files modified:** 6

## Accomplishments

- Split monolithic docker-compose.yml into `docker-compose.infra.yml` (4 infra services, self-contained) and `docker-compose.yml` (include + 6 app services)
- Exposed all infrastructure ports on host: PostgreSQL 5432, Redis 6379, RabbitMQ 5672/15672, MinIO 9000/9001
- Reverted unauthorized POSTGRES_PORT variable to hardcoded standard 5432
- Removed NODE_ENV from Zod schema and all env files; replaced CORS refine with CORS_STRICT boolean flag
- Synchronized .env, .env.docker, .env.example with identical key sets (PROTO_DIR is Docker-only exception)
- Added .env.docker to .gitignore

## Task Commits

Each task was committed atomically:

1. **Task 1: Split docker-compose and fix ports** - `3168d93` (feat)
2. **Task 2: Sync env files, remove NODE_ENV, fix CORS refine** - `c768eef` (feat)

**Task 3: Verify both dev modes** - HUMAN NEEDED (see below)

## HUMAN NEEDED: Task 3 - Verify Both Dev Modes

Task 3 is a human verification checkpoint. The following commands need to be run manually:

### Mode 1: Infrastructure-only (local dev)

```bash
docker compose -f infra/docker-compose.infra.yml up -d
docker compose -f infra/docker-compose.infra.yml ps
```

Verify:
- PostgreSQL: `pg_isready -h localhost -p 5432`
- Redis: `docker compose -f infra/docker-compose.infra.yml exec redis redis-cli ping`
- RabbitMQ management: open http://localhost:15672 (guest/guest)
- MinIO console: open http://localhost:9001

```bash
docker compose -f infra/docker-compose.infra.yml down
```

### Mode 2: Full Docker

```bash
docker compose -f infra/docker-compose.yml up --build
```

Verify all 10 containers (4 infra + 6 services) start and show healthy.

## Files Created/Modified

- `infra/docker-compose.infra.yml` - New self-contained infra-only compose (postgres, redis, rabbitmq, minio)
- `infra/docker-compose.yml` - Rewritten to use include directive + 6 app services only
- `packages/config/src/env-schema.ts` - Removed NODE_ENV, added CORS_STRICT boolean flag
- `.env.example` - Updated with full canonical key set, CORS_STRICT, PROTO_DIR documented
- `.gitignore` - Added .env.docker
- `.env` - Added POSTGRES_USER/PASSWORD/DB, CORS_STRICT, removed PROTO_DIR (not tracked)
- `.env.docker` - Removed NODE_ENV, added CORS_STRICT (not tracked)

## Decisions Made

- **CORS_STRICT replaces NODE_ENV:** Instead of checking `NODE_ENV === 'production'` in the Zod refine, a `CORS_STRICT` boolean flag controls whether wildcard CORS is rejected. This follows 12-Factor Factor X (no env branching).
- **PROTO_DIR is Docker-only:** Local dev uses the contracts package path directly via proto-resolver. Docker needs `/app/proto`. This is the one documented exception to env file key sync.
- **Standard ports hardcoded:** Per infrastructure-guard skill, all ports (5432, 6379, 5672, 15672, 9000, 9001) are hardcoded in compose, not variables.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `.env` and `.env.docker` are in `.gitignore` so they cannot be `git add`-ed. Only `.env.example` (the tracked template) was committed. The local `.env` and `.env.docker` files were updated on disk but remain untracked as intended.

## User Setup Required

After pulling these changes, developers should regenerate their local env files:
```bash
cp .env.example .env      # Then adjust hostnames to localhost
cp .env.example .env.docker  # Then adjust hostnames to Docker service names
```

## Next Phase Readiness

- Both compose files validate (`docker compose config --quiet` passes)
- Build passes with updated Zod schema (all 10 Turbo tasks successful)
- Ready for Phase 16 (CI Pipeline) -- compose files and env template are clean

---
*Phase: 15-docker-compose-split-environment*
*Completed: 2026-04-04*
