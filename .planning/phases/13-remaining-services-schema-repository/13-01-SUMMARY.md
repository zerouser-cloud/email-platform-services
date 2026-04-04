---
phase: 13-remaining-services-schema-repository
plan: 01
subsystem: database
tags: [drizzle, postgresql, pgSchema, repository-pattern, clean-architecture, persistence]

# Dependency graph
requires:
  - phase: 12-auth-schema-repository-reference
    provides: Auth Drizzle persistence pattern (schema, mapper, repository, module wiring)
provides:
  - Sender pgSchema('sender') with campaigns table and PgCampaignRepository
  - Parser pgSchema('parser') with parser_tasks table and PgParserTaskRepository
  - Audience pgSchema('audience') with recipients table and PgRecipientRepository
  - drizzle.config.ts per service with schema-scoped migrations
  - DATABASE_HEALTH indicator in all 3 service health controllers
affects: [14-verification-documentation]

# Tech tracking
tech-stack:
  added: [drizzle-orm@0.45.2 (sender/parser/audience), drizzle-kit@0.31.10 (sender/parser/audience)]
  patterns: [pgSchema-per-service isolation, toDomain/toPersistence mapper, repository adapter via DRIZZLE DI token]

key-files:
  created:
    - apps/sender/src/infrastructure/persistence/schema/campaigns.schema.ts
    - apps/sender/src/infrastructure/persistence/campaign.mapper.ts
    - apps/sender/src/infrastructure/persistence/pg-campaign.repository.ts
    - apps/sender/drizzle.config.ts
    - apps/parser/src/infrastructure/persistence/schema/parser-tasks.schema.ts
    - apps/parser/src/infrastructure/persistence/parser-task.mapper.ts
    - apps/parser/src/infrastructure/persistence/pg-parser-task.repository.ts
    - apps/parser/drizzle.config.ts
    - apps/audience/src/infrastructure/persistence/schema/recipients.schema.ts
    - apps/audience/src/infrastructure/persistence/recipient.mapper.ts
    - apps/audience/src/infrastructure/persistence/pg-recipient.repository.ts
    - apps/audience/drizzle.config.ts
  modified:
    - apps/sender/package.json
    - apps/sender/src/sender.module.ts
    - apps/sender/src/health/health.module.ts
    - apps/sender/src/health/health.controller.ts
    - apps/parser/package.json
    - apps/parser/src/parser.module.ts
    - apps/parser/src/health/health.module.ts
    - apps/parser/src/health/health.controller.ts
    - apps/audience/package.json
    - apps/audience/src/audience.module.ts
    - apps/audience/src/health/health.module.ts
    - apps/audience/src/health/health.controller.ts

key-decisions:
  - "Exact auth pattern replication: no deviations from D-01 reference"
  - "Mapper toPersistence takes only domain entity (no extra args unlike auth's passwordHash) since all fields are in entity"

patterns-established:
  - "pgSchema per service: each service owns its own PostgreSQL schema namespace"
  - "drizzle.config.ts per service: schemaFilter scopes migrations to service boundary"
  - "Repository adapter pattern: @Inject(DRIZZLE) + mapper + port interface"

requirements-completed: [REPO-02, REPO-03]

# Metrics
duration: 5min
completed: 2026-04-04
---

# Phase 13 Plan 01: Remaining Services Schema & Repository Summary

**Drizzle persistence layers for sender, parser, and audience replicating auth reference pattern with pgSchema isolation, mappers, and repository adapters**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-04T10:37:09Z
- **Completed:** 2026-04-04T10:41:50Z
- **Tasks:** 3
- **Files modified:** 27 (9 per service)

## Accomplishments
- Sender service has campaigns table in pgSchema('sender') with PgCampaignRepository implementing CampaignRepositoryPort
- Parser service has parser_tasks table in pgSchema('parser') with PgParserTaskRepository implementing ParserTaskRepositoryPort
- Audience service has recipients table in pgSchema('audience') with PgRecipientRepository implementing RecipientRepositoryPort
- All 6 services build successfully with zero Drizzle type leaks in domain/application layers
- DATABASE_HEALTH indicator wired in all 3 service readiness checks

## Task Commits

Each task was committed atomically:

1. **Task 1: Sender persistence layer** - `fac0a2f` (feat)
2. **Task 2: Parser persistence layer** - `a0f11fe` (feat)
3. **Task 3: Audience persistence layer** - `288764e` (feat)

## Files Created/Modified
- `apps/sender/src/infrastructure/persistence/schema/campaigns.schema.ts` - pgSchema('sender') + campaigns table
- `apps/sender/src/infrastructure/persistence/campaign.mapper.ts` - CampaignMapper toDomain/toPersistence
- `apps/sender/src/infrastructure/persistence/pg-campaign.repository.ts` - PgCampaignRepository with DRIZZLE injection
- `apps/sender/drizzle.config.ts` - Drizzle-kit config scoped to sender schema
- `apps/parser/src/infrastructure/persistence/schema/parser-tasks.schema.ts` - pgSchema('parser') + parser_tasks table
- `apps/parser/src/infrastructure/persistence/parser-task.mapper.ts` - ParserTaskMapper toDomain/toPersistence
- `apps/parser/src/infrastructure/persistence/pg-parser-task.repository.ts` - PgParserTaskRepository with DRIZZLE injection
- `apps/parser/drizzle.config.ts` - Drizzle-kit config scoped to parser schema
- `apps/audience/src/infrastructure/persistence/schema/recipients.schema.ts` - pgSchema('audience') + recipients table
- `apps/audience/src/infrastructure/persistence/recipient.mapper.ts` - RecipientMapper toDomain/toPersistence
- `apps/audience/src/infrastructure/persistence/pg-recipient.repository.ts` - PgRecipientRepository with DRIZZLE injection
- `apps/audience/drizzle.config.ts` - Drizzle-kit config scoped to audience schema
- `apps/sender/src/sender.module.ts` - Added PersistenceModule + CAMPAIGN_REPOSITORY_PORT provider
- `apps/parser/src/parser.module.ts` - Added PersistenceModule + PARSER_TASK_REPOSITORY_PORT provider
- `apps/audience/src/audience.module.ts` - Added PersistenceModule + RECIPIENT_REPOSITORY_PORT provider
- `apps/*/src/health/health.module.ts` - Added PersistenceModule.forRootAsync() import
- `apps/*/src/health/health.controller.ts` - Added DATABASE_HEALTH injection in readiness check
- `apps/*/package.json` - Added drizzle-orm, drizzle-kit, db:generate/db:migrate scripts

## Decisions Made
- Exact auth pattern replication per D-01 -- no architectural deviations
- Mapper toPersistence takes only domain entity (unlike auth's passwordHash extra arg) since all domain fields map directly to schema columns

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None -- all persistence layers are fully wired with real Drizzle query implementations (select, insert, onConflictDoUpdate).

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 domain services (auth, sender, parser, audience) have complete Drizzle persistence layers
- Ready for Phase 14: full-stack verification and documentation update
- drizzle-kit generate/migrate available per service for migration generation

---
*Phase: 13-remaining-services-schema-repository*
*Completed: 2026-04-04*
