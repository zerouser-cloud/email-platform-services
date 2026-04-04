# Phase 12: Auth Schema & Repository (Reference) - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Auth service gets a complete Drizzle persistence layer: pgSchema, table definition, drizzle-kit migrations, PgUserRepository implementing UserRepositoryPort. This is the reference pattern — Phase 13 replicates it to other services. Domain and application layers remain pure.

</domain>

<decisions>
## Implementation Decisions

### Schema Design
- **D-01:** Minimal schema sufficient to validate the full pattern (pgSchema → table → migration → repository → mapper). This is a foundation proof, not final business model.
- **D-02:** `pgSchema('auth')` for namespace isolation. Table: `auth.users` with columns: id (uuid PK), email (varchar unique), password_hash (varchar), role (varchar), organization (varchar), team (varchar), created_at (timestamp), updated_at (timestamp).
- **D-03:** `password_hash` stays in schema only, NOT in domain entity. User entity maps only business fields (id, email, role, organization, team). Login/auth concerns handled through separate port methods later.
- **D-04:** ID strategy: UUID v4 via `crypto.randomUUID()`. PostgreSQL `uuid` type. Default generated in app, not DB.
- **D-05:** `created_at` and `updated_at` default to `now()` in schema. Not mapped to domain entity (audit/infra concern).

### Migration Workflow
- **D-06:** Use `drizzle-kit generate` + `drizzle-kit migrate` (not `push`). Generates SQL migration files for traceability.
- **D-07:** `drizzle.config.ts` in `apps/auth/` root. Scoped to auth pgSchema only. DATABASE_URL from env.
- **D-08:** Install `drizzle-kit` as devDependency in `apps/auth/` (not in foundation — each service manages its own migrations).
- **D-09:** Migration files output to `apps/auth/drizzle/` directory.

### Mapper Pattern
- **D-10:** Mapper file at `apps/auth/src/infrastructure/persistence/user.mapper.ts`. Two functions: `toDomain(row)` → User entity, `toPersistence(user)` → insert object.
- **D-11:** Drizzle types (`$inferSelect`, `$inferInsert`, table references) only in infrastructure/persistence/. Domain and application import nothing from Drizzle.

### Repository Implementation
- **D-12:** `PgUserRepository` at `apps/auth/src/infrastructure/persistence/pg-user.repository.ts`. Implements `UserRepositoryPort` interface. Injects `DRIZZLE` token from PersistenceModule.
- **D-13:** Repository methods use Drizzle query API (select, insert, eq) with mappers for conversion.

### Module Wiring
- **D-14:** Auth module imports `PersistenceModule.forRootAsync()` and registers `{ provide: 'UserRepositoryPort', useClass: PgUserRepository }`.
- **D-15:** Health module gets database health via PersistenceModule (DATABASE_HEALTH token already exported).

### Claude's Discretion
- Exact column lengths (varchar(255) etc.)
- Whether to add indexes beyond unique email
- Exact drizzle-kit script names in package.json

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Domain entity and ports
- `apps/auth/src/domain/entities/user.entity.ts` — Current User entity (5 fields)
- `apps/auth/src/application/ports/outbound/user-repository.port.ts` — UserRepositoryPort interface (findByEmail, save)
- `apps/auth/src/application/use-cases/login.use-case.ts` — LoginUseCase stub (injects UserRepositoryPort)

### Module wiring
- `apps/auth/src/auth.module.ts` — Current module (no persistence imports, USER_REPOSITORY_PORT token defined)

### Foundation persistence (from Phase 10)
- `packages/foundation/src/persistence/persistence.module.ts` — PersistenceModule facade
- `packages/foundation/src/persistence/persistence.constants.ts` — DRIZZLE, PG_POOL, DATABASE_HEALTH tokens
- `packages/foundation/src/persistence/database-health.interface.ts` — DatabaseHealthIndicator interface

### Health
- `apps/auth/src/health/health.module.ts` — Health module (needs DATABASE_HEALTH import)
- `apps/auth/src/health/health.controller.ts` — Health controller (needs to use DATABASE_HEALTH)

### Research
- `.planning/research/ARCHITECTURE.md` — pgSchema patterns, Drizzle integration
- `.planning/research/STACK.md` — drizzle-orm, drizzle-kit versions
- `.planning/phases/10-foundation-drizzlemodule-health/10-RESEARCH.md` — Drizzle API details

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PersistenceModule.forRootAsync()` — ready to import (Phase 10)
- `USER_REPOSITORY_PORT` string token — already defined in auth.module.ts
- User entity — already exists, just needs schema to match

### Established Patterns
- DI string tokens for ports: `'UserRepositoryPort'`, `'LoginPort'`
- Health indicators via DI tokens from foundation
- LoggingModule.forGrpcAsync('auth') — async factory pattern to follow

### Integration Points
- auth.module.ts — add PersistenceModule import + PgUserRepository provider
- health.module.ts — add DATABASE_HEALTH indicator
- health.controller.ts — inject DATABASE_HEALTH for readiness check
- LoginUseCase — already injects UserRepositoryPort, will work with PgUserRepository via DI

</code_context>

<specifics>
## Specific Ideas

- This is a PATTERN PROOF, not final business model. Entity/schema will evolve later.
- Focus: demonstrate full chain works (schema → migration → repository → mapper → DI → use case)
- Each phase verifies all 6 services start and health checks pass

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 12-auth-schema-repository-reference*
*Context gathered: 2026-04-04*
