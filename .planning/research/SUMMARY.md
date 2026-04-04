# Project Research Summary

**Project:** Email Platform v2.0 -- PostgreSQL + Drizzle Migration
**Domain:** Database persistence layer migration in NestJS microservices monorepo
**Researched:** 2026-04-04
**Confidence:** HIGH

## Executive Summary

This migration replaces MongoDB with PostgreSQL + Drizzle ORM across 4 of 6 NestJS microservices (auth, sender, parser, audience). The critical insight from codebase analysis: all existing repository implementations are stubs throwing `NotImplementedException` -- no actual MongoDB driver is installed, no live data exists. This is a greenfield persistence integration, not a data migration, which dramatically reduces risk and complexity.

The recommended approach uses a single PostgreSQL 16 instance with per-service schemas (`pgSchema`) for logical isolation, Drizzle ORM 0.45.x with node-postgres (`pg`) as the driver, and a custom `DrizzleModule` in the foundation package following the same pattern as the existing `LoggingModule`. The architecture preserves hexagonal boundaries: Drizzle schemas and repository adapters live exclusively in `infrastructure/persistence/`, domain entities remain pure TypeScript classes, and repository port interfaces in the application layer reference only domain types. Gateway and notifier are completely unaffected.

The top risks are: Drizzle types leaking into the domain layer (breaking hexagonal architecture), missing connection pool cleanup on shutdown (causing connection exhaustion across 4 services), and migration race conditions when multiple services start simultaneously. All are preventable with established patterns documented in the research. The build order follows the dependency chain: config -> foundation -> Docker -> auth (reference implementation) -> remaining services.

## Key Findings

### Recommended Stack

The stack adds 4 packages to the monorepo. All versions verified against npm registry on 2026-04-04.

**Core technologies:**
- **PostgreSQL 16-alpine**: Primary database -- relational model fits domain (campaigns -> groups -> recipients), ACID transactions, mature tooling
- **drizzle-orm 0.45.2**: Type-safe ORM -- SQL-like API, zero runtime overhead, schema-as-code in TypeScript, no code generation step (unlike Prisma), no engine binary
- **pg 8.20.0** (node-postgres): PostgreSQL driver -- Pool class integrates naturally with NestJS DI and lifecycle hooks (`pool.end()` for shutdown)
- **drizzle-kit 0.31.10**: Migration CLI (devDependency only) -- generates SQL from schema diffs, applies migrations

**Explicitly rejected:** Prisma (code generation + engine binary), TypeORM (decorator schemas conflict with domain-first), postgres.js (Pool less NestJS-friendly), @knaadh/nestjs-drizzle-pg (unnecessary abstraction over 15 lines of code).

**Version warning:** Drizzle v1.0.0-beta exists but is not production-ready. Pin 0.45.x with tilde versions (`~0.45.2`), never caret.

### Expected Features

**Must have (table stakes):**
- PostgreSQL in Docker Compose replacing MongoDB
- `DATABASE_URL` env variable replacing `MONGODB_URI`
- `DrizzleModule.forRoot()` in foundation package
- `PostgresHealthIndicator` replacing `MongoHealthIndicator`
- Per-service Drizzle schema files with `pgSchema` isolation
- Migration generation and execution workflow
- Complete removal of all MongoDB references

**Should have (DX improvement):**
- Drizzle Studio integration for visual DB browsing
- Turbo pipeline for migration commands
- Graceful shutdown with `pool.end()`

**Defer (not needed now):**
- Connection pool monitoring (no load yet)
- Turbo migration pipeline (manual commands work)
- Abstract database interface (over-engineering)
- Auto-migration on boot for production (race conditions)

**Anti-features (explicitly avoid):**
- Shared schema package across services -- violates data ownership
- Cross-service foreign keys -- services communicate via gRPC
- Database-per-service -- operational overhead for no benefit at current scale
- JSONB as escape hatch from normalization -- honor the relational model

### Architecture Approach

Single PostgreSQL database with 4 named schemas (`auth`, `sender`, `parser`, `audience`). Each service owns its schema definitions, migrations, and repository adapters in `infrastructure/persistence/`. The shared `DrizzleModule` in `packages/foundation/` provides the Drizzle instance via NestJS DI, with Pool exposed as a separate provider for health checks and shutdown. Domain entities and application ports remain untouched -- only the infrastructure layer changes.

**Major components:**
1. **DrizzleModule** (packages/foundation) -- NestJS DynamicModule providing `DRIZZLE` and `PG_POOL` injection tokens, global scope
2. **PostgresHealthIndicator** (packages/foundation) -- Replaces MongoHealthIndicator, executes `SELECT 1` via injected Drizzle instance
3. **Per-service schemas** (apps/*/infrastructure/persistence/schema/) -- Drizzle `pgTable` definitions using `pgSchema` for namespace isolation
4. **Repository adapters** (apps/*/infrastructure/persistence/) -- Implement existing port interfaces (e.g., `UserRepositoryPort`) using Drizzle queries
5. **Per-service drizzle.config.ts** (apps/*/drizzle.config.ts) -- CLI config for migration generation, scoped to service's own schema

### Critical Pitfalls

1. **Drizzle types leaking into domain** -- `InferSelectModel` and `pgTable` imports outside `infrastructure/` break hexagonal architecture. Enforce with ESLint `no-restricted-imports` and code review. Repository adapters must contain explicit `toDomain()`/`toPersistence()` mappers.

2. **No connection pool cleanup on shutdown** -- Drizzle does not manage pool lifecycle. Without explicit `pool.end()` in `OnApplicationShutdown`, connections accumulate across restarts (4 services x 10 default = 40 connections). Store Pool as separate provider, implement shutdown hook.

3. **Eager database connection at module load** -- Drizzle examples show top-level initialization. Must use NestJS `useFactory` with `ConfigService` injection to ensure config is loaded and validated before pool creation.

4. **Shared public schema without isolation** -- All 4 services defaulting to `public` schema leads to table collisions and cross-service JOINs. Use `pgSchema('auth')` etc. from day one, with `schemaFilter` in drizzle.config.ts.

5. **Manually editing generated migration files** -- Breaks Drizzle Kit's snapshot mechanism. Never edit SQL files; revert schema change and regenerate instead. Commit migrations to git as source of truth.

## Implications for Roadmap

Based on research, suggested phase structure follows the dependency chain: config -> foundation -> infrastructure -> reference implementation -> replication -> verification.

### Phase 1: Config and Environment Update
**Rationale:** Everything depends on `DATABASE_URL` existing in the config schema. This is the leaf dependency.
**Delivers:** Updated env-schema.ts (`MONGODB_URI` -> `DATABASE_URL`), updated infrastructure.ts, updated `.env.docker` and `.env.example`
**Addresses:** Table stakes (DATABASE_URL env variable)
**Avoids:** Pitfall 20 (MongoDB leftovers) -- systematic grep for all mongo references

### Phase 2: Foundation Package (DrizzleModule + Health)
**Rationale:** Services cannot wire persistence without DrizzleModule. Health indicator swap validates the connection works before any schema work begins.
**Delivers:** `DrizzleModule.forRoot()`, `PostgresHealthIndicator`, `DRIZZLE`/`PG_POOL` constants, updated barrel exports, removed MongoDB health indicator
**Addresses:** Table stakes (DrizzleModule, health indicator swap)
**Avoids:** Pitfall 3 (eager connection -- use factory provider), Pitfall 4 (pool cleanup -- separate Pool provider + shutdown hook), Pitfall 13 (driver confusion -- enforce pg in foundation)

### Phase 3: Docker Infrastructure
**Rationale:** Need a running PostgreSQL instance before schema work. Docker Compose change is isolated and testable independently.
**Delivers:** PostgreSQL 16-alpine in docker-compose.yml, healthcheck, volume, depends_on updates for all services, pool size configuration
**Addresses:** Table stakes (PostgreSQL Docker service)
**Avoids:** Pitfall 19 (pool exhaustion -- set explicit max, increase max_connections), Pitfall 20 (remove mongo volumes and depends_on)

### Phase 4: Auth Service (Reference Implementation)
**Rationale:** Auth is the most complete Clean/Hexagonal implementation. Establishing the full pattern here (schema -> migration -> repository -> module wiring) creates a reference for remaining services.
**Delivers:** `authSchema` with pgSchema('auth'), users table, `PgUserRepository` implementing `UserRepositoryPort`, drizzle.config.ts, first migration, module wiring update
**Addresses:** Table stakes (per-service schema, migration workflow)
**Avoids:** Pitfall 1 (schema in domain -- infrastructure/ only), Pitfall 2 (pgSchema isolation), Pitfall 7 (verify CREATE SCHEMA in first migration), Pitfall 12 (drizzle.config.ts at service root)

### Phase 5: Remaining Services (sender, parser, audience)
**Rationale:** Mechanical replication of auth pattern. Can be parallelized across services since schemas are independent.
**Delivers:** Schema files, repository adapters, drizzle.config.ts, and migrations for sender (Campaign), parser (ParserTask), audience (Recipient/Group)
**Addresses:** Table stakes (all service schemas complete)
**Avoids:** Pitfall 8 (JSONB escape hatch -- normalize business entities), Pitfall 9 (FK indexes -- explicit index on every FK), Pitfall 17 (.notNull() on required columns)

### Phase 6: Verification and Cleanup
**Rationale:** Full-stack validation ensures no leftover MongoDB references and all health checks pass.
**Delivers:** All services boot successfully, health checks green, no MongoDB references anywhere, migration workflow documented
**Addresses:** Table stakes (remove all MongoDB references)
**Avoids:** Pitfall 11 (DI mismatch -- gateway/notifier must NOT import PostgresHealthIndicator), Pitfall 6 (migration race -- verify startup order works)

### Phase Ordering Rationale

- **Config before foundation**: DrizzleModule depends on `DATABASE_URL` being in the validated config schema
- **Foundation before Docker**: DrizzleModule code must exist before integration testing, but Docker can be developed in parallel
- **Auth before other services**: Validates the full pattern end-to-end; mistakes caught early on one service, not four
- **Other services after auth**: Mechanical replication reduces risk; each service is independent (no cross-schema dependencies)
- **Verification last**: Integration testing only meaningful when all components exist

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (Auth reference):** Schema design decisions (ID generation strategy, timestamp conventions, column types) need careful thought since they set the pattern for all services
- **Phase 5 (Remaining services):** Audience service may have more complex schema (recipients + groups + many-to-many); sender has campaign + email_jobs relationship

Phases with standard patterns (skip research-phase):
- **Phase 1 (Config):** Simple find-and-replace in Zod schema and env files
- **Phase 2 (Foundation):** Architecture research already provides complete DrizzleModule code
- **Phase 3 (Docker):** Standard postgres:16-alpine Docker Compose configuration
- **Phase 6 (Verification):** Checklist-driven validation

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified via live npm registry queries. pg + drizzle-orm is the dominant NestJS pattern. |
| Features | HIGH | Clear table stakes derived from codebase analysis. Anti-features well-justified by architecture constraints. |
| Architecture | HIGH | pgSchema isolation, DrizzleModule pattern, repository adapter placement all verified against official Drizzle docs and NestJS best practices. Complete code examples provided. |
| Pitfalls | HIGH | 22 pitfalls documented with prevention strategies. Critical ones (type leaking, pool cleanup, eager init) are well-known community issues with established solutions. |

**Overall confidence:** HIGH

### Gaps to Address

- **ID generation strategy:** Research identifies text PKs with application-generated IDs but does not prescribe NanoID vs UUIDv7. Decision needed in Phase 4 schema design.
- **Transaction boundaries / Unit of Work:** Pitfall 10 flags this as a design concern. Port interfaces should accept optional transaction context, but full implementation deferred until business logic phase. Design the interface shape during Phase 4.
- **Drizzle v1.0 migration path:** Current recommendation pins 0.45.x. Monitor v1.0 stable release. Upgrade path documented at orm.drizzle.team/docs/upgrade-v1.
- **Migration execution in production:** Research flags race conditions with concurrent service startup. For local dev, `migrate()` in main.ts is acceptable. Production strategy (init-container, separate job) needs decision before deployment -- not blocking for this milestone.
- **Drizzle project maintenance pace:** Open issues and PR backlog noted. Core functionality is stable. Kysely identified as contingency alternative. Monitor but do not act.

## Sources

### Primary (HIGH confidence)
- [Drizzle ORM - PostgreSQL Getting Started](https://orm.drizzle.team/docs/get-started-postgresql)
- [Drizzle ORM - pgSchema documentation](https://orm.drizzle.team/docs/schemas)
- [Drizzle ORM - Migrations](https://orm.drizzle.team/docs/migrations)
- [Drizzle Kit - Config reference](https://orm.drizzle.team/docs/drizzle-config-file)
- [NestJS Health Checks with Terminus](https://docs.nestjs.com/recipes/terminus)
- [NestJS Dynamic Modules](https://docs.nestjs.com/fundamentals/dynamic-modules)
- [NestJS Lifecycle Events](https://docs.nestjs.com/fundamentals/lifecycle-events)
- [node-postgres documentation](https://node-postgres.com/)
- npm registry (live queries for drizzle-orm, drizzle-kit, pg, @types/pg)

### Secondary (MEDIUM confidence)
- [Trilon: NestJS and DrizzleORM integration](https://trilon.io/blog/nestjs-drizzleorm-a-great-match)
- [nestjs-cls Drizzle transactional adapter](https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional/drizzle-orm-adapter)
- [Wanago: NestJS #149 Drizzle ORM with PostgreSQL](http://wanago.io/2024/05/20/api-nestjs-drizzle-orm-postgresql/)
- [PostgreSQL schema-per-microservice](https://dev.to/lbelkind/does-your-microservice-deserve-its-own-database-np2)
- [Infisical: MongoDB to PostgreSQL Migration](https://infisical.com/blog/postgresql-migration-technical)

### Tertiary (LOW confidence)
- [Drizzle project health discussion](https://github.com/drizzle-team/drizzle-orm/issues/4391) -- maintenance pace concern, monitoring only
- [Drizzle ORM v1 Upgrade Guide](https://orm.drizzle.team/docs/upgrade-v1) -- future reference

---
*Research completed: 2026-04-04*
*Ready for roadmap: yes*
