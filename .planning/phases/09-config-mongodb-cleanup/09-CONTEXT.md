# Phase 9: Config & MongoDB Cleanup - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace MONGODB_URI with DATABASE_URL in config schema, remove all MongoDB references from the entire codebase. After this phase, `grep -ri mongo` returns zero matches (excluding node_modules and git history). All 6 services must start successfully.

</domain>

<decisions>
## Implementation Decisions

### Config Schema
- **D-01:** Replace `MONGODB_URI: z.string().min(1)` with `DATABASE_URL: z.string().url()` in `packages/config/src/infrastructure.ts`. Use Zod `.url()` for basic format validation of PostgreSQL connection string (`postgresql://user:pass@host:port/db`).
- **D-02:** Update all config references across services — any service importing `InfrastructureConfig` will pick up the type change automatically.

### MongoDB File Deletion
- **D-03:** Delete all 4 mongo-*.repository.ts files (auth, sender, parser, audience). These are stubs (throw NotImplementedException). Drizzle repositories will be created from scratch in Phase 12-13.
- **D-04:** Delete `packages/foundation/src/health/indicators/mongodb.health.ts` (MongoHealthIndicator). PostgresHealthIndicator will be created in Phase 10.
- **D-05:** Remove MongoHealthIndicator imports and registrations from all health modules and the foundation barrel export.

### Health Module Cleanup
- **D-06:** After removing MongoHealthIndicator, health controllers that referenced it should have the indicator removed (not replaced yet — Phase 10 adds the new one). Services will still start — readiness checks will just skip the DB check temporarily.

### Docker Compose
- **D-07:** MongoDB removal from docker-compose is NOT in Phase 9 scope — that's Phase 11 (INFRA-02). Phase 9 only cleans code references. Docker-compose changes happen later when PostgreSQL is added.

### Claude's Discretion
- Exact grep commands to verify zero mongo references
- Order of file deletions and config updates
- Whether to update .env.docker or .env.example files in this phase

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Config schema
- `packages/config/src/infrastructure.ts` — Current MONGODB_URI definition to replace
- `packages/config/src/env-schema.ts` — Global env schema composing InfrastructureSchema

### Health indicators
- `packages/foundation/src/health/indicators/mongodb.health.ts` — MongoHealthIndicator to delete
- `packages/foundation/src/health/health-constants.ts` — Health constants (may reference mongo)
- `packages/foundation/src/index.ts` — Barrel export to clean

### Repository stubs (to delete)
- `apps/auth/src/infrastructure/persistence/mongo-user.repository.ts`
- `apps/sender/src/infrastructure/persistence/mongo-campaign.repository.ts`
- `apps/parser/src/infrastructure/persistence/mongo-parser-task.repository.ts`
- `apps/audience/src/infrastructure/persistence/mongo-recipient.repository.ts`

### Health modules (to clean imports)
- `apps/auth/src/health/health.module.ts`
- `apps/sender/src/health/health.module.ts`
- `apps/parser/src/health/health.module.ts`
- `apps/audience/src/health/health.module.ts`

### Service modules (to clean DI bindings)
- `apps/auth/src/auth.module.ts`
- `apps/sender/src/sender.module.ts`
- `apps/parser/src/parser.module.ts`
- `apps/audience/src/audience.module.ts`

</canonical_refs>

<code_context>
## Existing Code Insights

### Files to Delete (20 mongo references total)
- 4 mongo-*.repository.ts files (all stubs with NotImplementedException)
- 1 mongodb.health.ts file (stub returning HEALTH.STUB_MESSAGE)

### Files to Modify
- `packages/config/src/infrastructure.ts` — MONGODB_URI → DATABASE_URL
- `packages/foundation/src/index.ts` — remove MongoHealthIndicator export
- 4 health.module.ts files — remove MongoHealthIndicator import/provider
- 4 health.controller.ts files — remove MongoHealthIndicator usage in readiness checks
- 4 *.module.ts files — remove mongo repository provider bindings

### Established Patterns
- Config changes propagate through Zod schema → TypeScript types → DI
- Health indicators are registered as providers in health modules
- Repository bindings use string tokens (e.g., 'UserRepositoryPort')

### Integration Points
- After deleting mongo repositories, DI bindings for repository tokens must be removed or pointed to a placeholder
- Services must still compile and start — verify with `pnpm build` and service startup

</code_context>

<specifics>
## Specific Ideas

- Success criterion: `grep -ri mongo` across entire codebase = zero matches
- Each phase must verify all 6 services start and health checks pass (user requirement)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 09-config-mongodb-cleanup*
*Context gathered: 2026-04-04*
