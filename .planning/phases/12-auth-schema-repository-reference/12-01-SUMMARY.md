---
phase: 12-auth-schema-repository-reference
plan: 01
subsystem: auth
tags: [drizzle-orm, drizzle-kit, pgSchema, postgresql, repository-pattern, clean-architecture]

requires:
  - phase: 10-foundation-drizzlemodule-health
    provides: PersistenceModule with DRIZZLE, PG_POOL, DATABASE_HEALTH tokens
  - phase: 11-docker-infrastructure
    provides: PostgreSQL 16 in docker-compose
provides:
  - Drizzle schema with pgSchema('auth') namespace isolation for users table
  - UserMapper with toDomain/toPersistence bidirectional mapping
  - PgUserRepository implementing UserRepositoryPort via Drizzle queries
  - drizzle-kit configuration scoped to auth schema
  - Database health indicator wired into auth readiness check
  - Reference pattern for Phase 13 service replication
affects: [13-remaining-services-schema-repository, 14-verification-documentation]

tech-stack:
  added: [drizzle-orm (auth), drizzle-kit (auth devDep)]
  patterns: [pgSchema per service, mapper toDomain/toPersistence, repository adapter with DI, DATABASE_HEALTH in readiness]

key-files:
  created:
    - apps/auth/src/infrastructure/persistence/schema/users.schema.ts
    - apps/auth/src/infrastructure/persistence/schema/index.ts
    - apps/auth/src/infrastructure/persistence/user.mapper.ts
    - apps/auth/src/infrastructure/persistence/pg-user.repository.ts
    - apps/auth/drizzle.config.ts
  modified:
    - apps/auth/package.json
    - apps/auth/src/auth.module.ts
    - apps/auth/src/health/health.module.ts
    - apps/auth/src/health/health.controller.ts

key-decisions:
  - "NodePgDatabase without schema generic -- select().from() API works without it"
  - "PersistenceModule imported in both AuthModule and HealthModule -- NestJS deduplicates, one pool instance"
  - "UserMapper as plain object, not class -- pure data transformer, no DI needed"
  - "passwordHash passed as separate arg to toPersistence since domain entity does not carry it"

patterns-established:
  - "pgSchema('serviceName') for namespace isolation per service"
  - "Schema barrel at infrastructure/persistence/schema/index.ts for drizzle-kit discovery"
  - "Mapper with toDomain (skips infra fields) and toPersistence (accepts extra args for non-domain fields)"
  - "Repository injects DRIZZLE token, uses select().from() and insert().values() API"
  - "drizzle.config.ts at app root with schemaFilter and migrations.schema scoped to service"
  - "HealthModule imports PersistenceModule.forRootAsync() for DATABASE_HEALTH access"

requirements-completed: [SCHM-01, SCHM-02, SCHM-03, REPO-01]

duration: 2min
completed: 2026-04-04
---

# Phase 12 Plan 01: Auth Schema & Repository (Reference) Summary

**Drizzle schema with pgSchema('auth') isolation, UserMapper, PgUserRepository implementing UserRepositoryPort, and DATABASE_HEALTH wired into readiness check**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-04T10:17:21Z
- **Completed:** 2026-04-04T10:19:41Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Complete persistence layer for auth: schema definition, mapper, repository adapter, drizzle-kit config
- pgSchema('auth') provides namespace isolation -- each service owns its PostgreSQL schema
- PgUserRepository implements UserRepositoryPort with clean toDomain/toPersistence mapping
- Zero Drizzle imports in domain/ or application/ -- Clean Architecture boundary preserved
- Database health indicator integrated into auth readiness check
- All 6 services build successfully

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema, mapper, repository, and drizzle-kit config** - `37f0c26` (feat)
2. **Task 2: Module wiring and health integration** - `43ba7f1` (feat)

## Files Created/Modified
- `apps/auth/src/infrastructure/persistence/schema/users.schema.ts` - pgSchema('auth') table definition with 8 columns
- `apps/auth/src/infrastructure/persistence/schema/index.ts` - Barrel export for drizzle-kit schema discovery
- `apps/auth/src/infrastructure/persistence/user.mapper.ts` - Bidirectional mapper (toDomain skips passwordHash/timestamps, toPersistence accepts passwordHash separately)
- `apps/auth/src/infrastructure/persistence/pg-user.repository.ts` - Repository adapter with findByEmail and save (upsert) via Drizzle
- `apps/auth/drizzle.config.ts` - drizzle-kit CLI config scoped to auth schema
- `apps/auth/package.json` - Added drizzle-orm, drizzle-kit, db:generate/db:migrate scripts
- `apps/auth/src/auth.module.ts` - Added PersistenceModule.forRootAsync() import and PgUserRepository as UserRepositoryPort provider
- `apps/auth/src/health/health.module.ts` - Added PersistenceModule.forRootAsync() import for DATABASE_HEALTH access
- `apps/auth/src/health/health.controller.ts` - Injected DATABASE_HEALTH, added postgresql readiness check

## Decisions Made
- Used `NodePgDatabase` without schema generic -- `select().from()` API works without it, no need for relational query API
- Imported `PersistenceModule.forRootAsync()` in both AuthModule and HealthModule -- NestJS deduplicates module instances, so only one pool is created while HealthModule gets direct access to DATABASE_HEALTH token
- UserMapper implemented as plain object (not class) -- pure data transformer with no state, no DI needed
- `toPersistence` accepts `passwordHash` as separate argument since domain User entity correctly excludes it (D-03)
- `save()` passes empty string for passwordHash -- intentional stub, real password handling deferred

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

- `apps/auth/src/infrastructure/persistence/pg-user.repository.ts` line 33: `toPersistence(user, '')` -- empty string for passwordHash in save(). Intentional: real password handling deferred per D-03. Will be resolved when auth business logic is implemented.

## Issues Encountered
None.

## User Setup Required
None -- no external service configuration required.

## Next Phase Readiness
- Auth persistence layer complete and validated as reference pattern
- Phase 13 can replicate this pattern mechanically to sender, parser, audience services
- All patterns documented in SUMMARY frontmatter (patterns-established) for downstream consumption

---
*Phase: 12-auth-schema-repository-reference*
*Completed: 2026-04-04*
