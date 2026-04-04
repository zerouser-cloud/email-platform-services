---
phase: 09-config-mongodb-cleanup
plan: 01
subsystem: infra
tags: [postgresql, mongodb-removal, config, zod, health-checks]

# Dependency graph
requires:
  - phase: 08-verification
    provides: validated v1.0 foundation with all 6 services building and healthy
provides:
  - DATABASE_URL in config schema with Zod .url() validation
  - Zero MongoDB references in codebase (code, config, documentation)
  - Clean health modules and controllers ready for PostgresHealthIndicator in Phase 10
  - Repository port tokens preserved for Phase 12-13 Drizzle wiring
affects: [10-foundation-drizzle, 11-docker-infrastructure, 12-auth-schema, 14-verification]

# Tech tracking
tech-stack:
  added: []
  patterns: [DATABASE_URL replaces MONGODB_URI as canonical database config key]

key-files:
  created: []
  modified:
    - packages/config/src/infrastructure.ts
    - packages/foundation/src/health/health-constants.ts
    - packages/foundation/src/index.ts
    - apps/auth/src/auth.module.ts
    - apps/sender/src/sender.module.ts
    - apps/parser/src/parser.module.ts
    - apps/audience/src/audience.module.ts
    - apps/auth/src/health/health.module.ts
    - apps/sender/src/health/health.module.ts
    - apps/parser/src/health/health.module.ts
    - apps/audience/src/health/health.module.ts
    - apps/auth/src/health/health.controller.ts
    - apps/sender/src/health/health.controller.ts
    - apps/parser/src/health/health.controller.ts
    - apps/audience/src/health/health.controller.ts
    - .env.docker
    - .env.example
    - CLAUDE.md

key-decisions:
  - "DATABASE_URL uses z.string().url() for PostgreSQL connection string validation"
  - "Repository port tokens kept without providers -- Phase 12-13 will wire Drizzle adapters"
  - "Health readiness checks temporarily skip DB indicator -- Phase 10 adds PostgresHealthIndicator"

patterns-established:
  - "DATABASE_URL as canonical database config key across all environments"

requirements-completed: [INFRA-01, INFRA-03]

# Metrics
duration: 4min
completed: 2026-04-04
---

# Phase 9 Plan 1: Purge MongoDB References Summary

**Replaced MONGODB_URI with DATABASE_URL across config/env, deleted 5 mongo stub files, cleaned 12 service/health modules, updated CLAUDE.md to reference PostgreSQL**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-04T08:45:31Z
- **Completed:** 2026-04-04T08:49:17Z
- **Tasks:** 3
- **Files modified:** 18

## Accomplishments
- Replaced MONGODB_URI with DATABASE_URL (Zod `.url()` validation) in config schema, propagating through env-schema automatically
- Deleted 4 mongo repository stubs and mongodb.health.ts indicator -- zero MongoDB code remains
- Cleaned 4 service modules (removed DI bindings), 4 health modules (removed MongoHealthIndicator provider), and 4 health controllers (removed mongo readiness checks)
- Updated CLAUDE.md with 8 MongoDB-to-PostgreSQL replacements across tech stack, architecture, and documentation sections
- All 6 services build successfully with `pnpm build` (10/10 tasks, zero errors)

## Task Commits

Each task was committed atomically:

1. **Task 1: Config schema, env files, and file deletions** - `e45d252` (chore)
2. **Task 2: Remove MongoDB from service modules, health modules, health controllers, and CLAUDE.md** - `ebd8bcd` (feat)
3. **Task 3: Full verification** - verification-only, no commit needed

## Files Created/Modified
- `packages/config/src/infrastructure.ts` - MONGODB_URI replaced with DATABASE_URL (z.string().url())
- `packages/foundation/src/health/health-constants.ts` - Removed HEALTH.INDICATOR.MONGODB
- `packages/foundation/src/index.ts` - Removed mongodb.health barrel export
- `apps/auth/src/auth.module.ts` - Removed MongoUserRepository import and DI binding
- `apps/sender/src/sender.module.ts` - Removed MongoCampaignRepository import and DI binding
- `apps/parser/src/parser.module.ts` - Removed MongoParserTaskRepository import and DI binding
- `apps/audience/src/audience.module.ts` - Removed MongoRecipientRepository import and DI binding
- `apps/{auth,sender,parser,audience}/src/health/health.module.ts` - Removed MongoHealthIndicator from providers
- `apps/{auth,sender,parser,audience}/src/health/health.controller.ts` - Removed mongo constructor param and readiness check
- `.env.docker` - MONGODB_URI replaced with DATABASE_URL (postgresql://)
- `.env.example` - MONGODB_URI replaced with DATABASE_URL (postgresql://)
- `CLAUDE.md` - All MongoDB references replaced with PostgreSQL

## Decisions Made
- Used `z.string().url()` for DATABASE_URL validation (validates URL format, catches malformed connection strings)
- Kept repository port tokens (USER_REPOSITORY_PORT, etc.) without providers -- use cases that inject these will fail at runtime if called, but all are stubs; Phase 12-13 will wire Drizzle adapters
- Health readiness checks have empty arrays for auth/parser/audience (sender keeps Redis); Phase 10 adds DatabaseHealthIndicator

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Fixed MONGO_URL reference in CLAUDE.md code style section**
- **Found during:** Task 2 (CLAUDE.md updates)
- **Issue:** Code style section referenced MONGO_URL as config value example, not listed in plan replacements
- **Fix:** Changed "App consumes config values (LOG_LEVEL, MONGO_URL)" to "App consumes config values (LOG_LEVEL, DATABASE_URL)"
- **Files modified:** CLAUDE.md
- **Verification:** grep -i mongo CLAUDE.md returns zero matches
- **Committed in:** ebd8bcd (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for INFRA-03 requirement (zero mongo references). No scope creep.

## Issues Encountered
- `.env` file is gitignored so it could not be committed, but was still updated locally for developer use
- `mongodb.health.ts` was untracked (never committed to current branch) so its deletion did not appear in git; the 4 repository files were tracked and their deletions were committed

## User Setup Required
None - no external service configuration required.

## Known Stubs
None -- this plan only removes stubs (mongo repositories) and does not create new ones. The empty readiness check arrays are intentional temporary state until Phase 10 adds DatabaseHealthIndicator.

## Next Phase Readiness
- Codebase has zero MongoDB awareness -- ready for Phase 10 (DrizzleModule, PostgresHealthIndicator)
- DATABASE_URL is validated and available via config DI
- Repository port tokens await Drizzle adapter wiring in Phase 12-13
- `infra/docker-compose.yml` still references MongoDB -- Phase 11 scope

---
*Phase: 09-config-mongodb-cleanup*
*Completed: 2026-04-04*
