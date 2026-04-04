# Phase 13: Remaining Services Schema & Repository - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Replicate the auth reference pattern (Phase 12) to sender, parser, and audience. Each gets: pgSchema, table, drizzle.config.ts, mapper, repository adapter, module wiring, health integration. Gateway and notifier are unaffected.

</domain>

<decisions>
## Implementation Decisions

### Pattern Replication (all from Phase 12)
- **D-01:** Exact same pattern as auth: pgSchema → schema file → mapper → repository → module wiring → health. No deviations.
- **D-02:** Each service gets its own pgSchema: `pgSchema('sender')`, `pgSchema('parser')`, `pgSchema('audience')`.
- **D-03:** drizzle-kit as devDependency per service. drizzle.config.ts per service with own schemaFilter.
- **D-04:** PersistenceModule.forRootAsync() in both service module and health module (NestJS deduplicates).

### Sender: Campaign Schema
- **D-05:** Table `sender.campaigns`. Columns: id (uuid PK), name (varchar), status (varchar), created_at, updated_at. Matches Campaign entity (id, name, status).
- **D-06:** `PgCampaignRepository` implements `CampaignRepositoryPort` (findById, save).

### Parser: ParserTask Schema
- **D-07:** Table `parser.parser_tasks`. Columns: id (uuid PK), status (varchar), category (varchar), created_at, updated_at. Matches ParserTask entity (id, status, category).
- **D-08:** `PgParserTaskRepository` implements `ParserTaskRepositoryPort` (findById, save).

### Audience: Recipient Schema
- **D-09:** Table `audience.recipients`. Columns: id (uuid PK), email (varchar), group_id (uuid), created_at, updated_at. Matches Recipient entity (id, email, groupId).
- **D-10:** `PgRecipientRepository` implements `RecipientRepositoryPort` (findById, save).

### Claude's Discretion
- Exact varchar lengths
- Additional indexes beyond PK
- Whether to add unique constraints on email in audience (likely yes, but this is a scaffold)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Auth reference (THE pattern to replicate)
- `apps/auth/src/infrastructure/persistence/schema/users.schema.ts` — pgSchema + table definition pattern
- `apps/auth/src/infrastructure/persistence/schema/index.ts` — schema barrel export
- `apps/auth/src/infrastructure/persistence/user.mapper.ts` — toDomain/toPersistence pattern
- `apps/auth/src/infrastructure/persistence/pg-user.repository.ts` — Repository + DRIZZLE injection
- `apps/auth/drizzle.config.ts` — drizzle-kit config pattern
- `apps/auth/src/auth.module.ts` — PersistenceModule + repository DI wiring
- `apps/auth/src/health/health.module.ts` — PersistenceModule for DATABASE_HEALTH
- `apps/auth/src/health/health.controller.ts` — DATABASE_HEALTH injection in readiness

### Domain entities and ports (what to implement)
- `apps/sender/src/domain/entities/campaign.entity.ts` — Campaign(id, name, status)
- `apps/sender/src/application/ports/outbound/campaign-repository.port.ts` — findById, save
- `apps/sender/src/sender.module.ts` — Module to wire

- `apps/parser/src/domain/entities/parser-task.entity.ts` — ParserTask(id, status, category)
- `apps/parser/src/application/ports/outbound/parser-task-repository.port.ts` — findById, save
- `apps/parser/src/parser.module.ts` — Module to wire

- `apps/audience/src/domain/entities/recipient.entity.ts` — Recipient(id, email, groupId)
- `apps/audience/src/application/ports/outbound/recipient-repository.port.ts` — findById, save
- `apps/audience/src/audience.module.ts` — Module to wire

### Foundation
- `packages/foundation/src/persistence/persistence.module.ts` — PersistenceModule facade
- `packages/foundation/src/persistence/persistence.constants.ts` — DRIZZLE, DATABASE_HEALTH tokens

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Auth Phase 12 files are the exact template to copy and adapt
- PersistenceModule already available from Phase 10

### Established Patterns
- Same file structure in each service: infrastructure/persistence/schema/, mapper, repository
- Same DI wiring: PersistenceModule in module + health, repository as provider
- Same drizzle.config.ts structure with service-specific schemaFilter

### Integration Points
- 3 service modules: sender.module.ts, parser.module.ts, audience.module.ts
- 3 health modules + controllers
- 3 package.json files (drizzle-kit devDep + scripts)

</code_context>

<specifics>
## Specific Ideas

- This is mechanical replication — no new patterns, just service-specific schemas
- Each phase verifies all 6 services start and health checks pass

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 13-remaining-services-schema-repository*
*Context gathered: 2026-04-04*
