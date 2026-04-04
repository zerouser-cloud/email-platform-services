# Domain Pitfalls: PostgreSQL + Drizzle Migration

**Domain:** Adding PostgreSQL + Drizzle ORM to existing NestJS microservices monorepo with Clean/Hexagonal architecture
**Researched:** 2026-04-04
**Confidence:** HIGH (verified against official Drizzle docs, codebase analysis, community patterns)

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or fundamental architectural violations.

### Pitfall 1: Drizzle Schema Types Leaking Into Domain Layer

**What goes wrong:** Drizzle table definitions (`pgTable`) get imported in domain entities or application use cases. Developers use `InferSelectModel<typeof users>` as the domain type, coupling domain to infrastructure.

**Why it happens:** Drizzle schemas are TypeScript code (not generated files like Prisma), making it tempting to reuse types directly. The line between "TypeScript type" and "infrastructure concern" blurs because both are `.ts` files in the same project. `InferSelectModel` gives the exact row type for free -- the convenience is seductive.

**Consequences:** Domain layer depends on `drizzle-orm/pg-core` -- violating Dependency Inversion. Changing database schema forces domain changes. Architecture validator flags violations. Domain entities lose behavior (become anemic Drizzle row types).

**Prevention:**
- Drizzle schema files live ONLY in `apps/*/src/infrastructure/persistence/schema/`
- Domain entities remain plain TypeScript classes (already the case: `User`, `Campaign`, `Recipient`, `ParserTask`)
- Repository adapters contain explicit mappers: `toDomain(row)` and `toPersistence(entity)`
- ESLint `no-restricted-imports` rule: ban `drizzle-orm` imports outside `infrastructure/` directories
- Repository port interfaces (e.g., `UserRepositoryPort`) reference domain types only -- never Drizzle types

**Detection:** `grep -r "drizzle-orm" apps/*/src/domain/ apps/*/src/application/` returns results.

**Applies to phase:** Schema definition, repository implementation

### Pitfall 2: Shared Database Without Schema Isolation

**What goes wrong:** All services with persistence write to the same `public` schema in PostgreSQL. Tables from different services intermingle. Developers start adding cross-service JOINs because "it's the same database."

**Why it happens:** MongoDB had no schema concept per collection, so developers default to PostgreSQL's `public` schema. A single `DATABASE_URL` env var makes it easy to connect all services to the same namespace. Relational thinking -- "campaigns reference audience groups, so they should share the schema" -- encourages schema coupling.

**Consequences:** Service boundaries erode. One service's migration breaks another service's tables. Cross-service JOINs create hidden coupling that defeats microservices. Eventually impossible to extract a service to its own database. Services can no longer be deployed independently.

**Prevention:**
- Use `pgSchema` to define per-service PostgreSQL schemas: `auth`, `sender`, `parser`, `audience`
- Each service's Drizzle config points to its own schema
- Separate `drizzle.config.ts` per service for independent migration generation
- No cross-schema foreign keys -- services communicate via gRPC/RabbitMQ only (already enforced)
- Cross-service references stored as plain text IDs, not foreign keys
- Gateway: no persistence (REST facade only). Notifier: event-consumer only, no persistence
- Example:
  ```typescript
  import { pgSchema } from 'drizzle-orm/pg-core';
  export const authSchema = pgSchema('auth');
  export const users = authSchema.table('users', { ... });
  ```

**Detection:** Any SQL joining tables owned by different services. Import paths crossing service boundaries in schema files.

**Applies to phase:** Database setup, schema definition, Docker Compose configuration

### Pitfall 3: Eager Database Connection at Module Load Time

**What goes wrong:** Database connection is created when the module file is imported (top-level `const db = drizzle(pool)`), before NestJS has loaded environment variables via ConfigService and validated them with Zod.

**Why it happens:** Drizzle examples in docs show top-level initialization. The current codebase has a precedent: `loadGlobalConfig()` was previously called at module scope (fixed in Phase 2). Coming from MongoDB stubs (which had no actual connection), developers don't realize PostgreSQL pools connect immediately.

**Consequences:** Application crashes with cryptic connection errors or `undefined` DATABASE_URL. Health checks fail because pool connects before config is ready. Breaks the `loadGlobalConfig()` -> Zod validation -> DI flow in `@email-platform/config`.

**Prevention:**
- Create Drizzle instance inside NestJS factory provider (`useFactory` with `ConfigService` injection)
- Pool creation must happen AFTER `AppConfigModule` initializes
- Expose pool as a separate provider for health checks and shutdown cleanup
- Pattern:
  ```typescript
  {
    provide: DRIZZLE_TOKEN,
    useFactory: (config: ConfigService) => {
      const pool = new Pool({ connectionString: config.get('DATABASE_URL') });
      return drizzle(pool, { schema });
    },
    inject: [ConfigService],
  }
  ```

**Detection:** `ECONNREFUSED` or `undefined` URL errors during bootstrap. Any `drizzle()` call outside of a NestJS provider factory.

**Applies to phase:** Drizzle module integration, config update

### Pitfall 4: No Connection Pool Cleanup on Shutdown

**What goes wrong:** NestJS application shuts down but PostgreSQL connection pool remains open. Connections leak. In Docker Compose with `restart: unless-stopped`, leaked connections accumulate until PostgreSQL hits `max_connections`.

**Why it happens:** Drizzle does NOT manage pool lifecycle -- it delegates to the underlying driver. Unlike Prisma's `$disconnect()`, there's no built-in cleanup. The codebase has `init: true` in Docker Compose (SIGTERM reaches Node), but without explicit `pool.end()` the connections leak.

**Consequences:** Connection exhaustion in PostgreSQL (default 100 connections). With 4 services each holding 10-connection pools = 40 minimum. After a few restarts, PostgreSQL refuses new connections. Silent production degradation.

**Prevention:**
- Store `Pool` reference separately from Drizzle instance (two injection tokens: `DRIZZLE` and `PG_POOL`)
- Implement `OnApplicationShutdown` to call `pool.end()`
- Enable shutdown hooks in every `main.ts`: `app.enableShutdownHooks()`
- Pattern:
  ```typescript
  @Injectable()
  export class DrizzleLifecycle implements OnApplicationShutdown {
    constructor(@Inject(PG_POOL) private readonly pool: Pool) {}
    async onApplicationShutdown(): Promise<void> {
      await this.pool.end();
    }
  }
  ```

**Detection:** Missing `pool.end()` call. Missing `enableShutdownHooks()`. Increasing `pg_stat_activity` connections after restarts.

**Applies to phase:** Drizzle module integration, health checks

### Pitfall 5: Manually Editing Generated Migration Files

**What goes wrong:** Developer modifies a generated migration SQL file or edits the migration journal/snapshot JSON. Subsequent `drizzle-kit generate` produces broken or conflicting migrations because the snapshot no longer matches reality.

**Why it happens:** Drizzle Kit generates SQL files with accompanying JSON snapshots in `meta/`. The temptation to "just fix this one line" is strong. The journal/snapshot mechanism is poorly documented. This is documented as the #1 mistake in community post-mortems.

**Consequences:** Migration state diverges from actual schema. Future `generate` produces incorrect diffs. Production database in inconsistent state. Rollback impossible.

**Prevention:**
- NEVER edit generated migration files -- create a new migration instead
- If a migration is wrong: revert the schema change in TypeScript, regenerate
- Use `drizzle-kit generate` for all migrations, `drizzle-kit push` only for local dev prototyping
- Commit migration files to git -- they are the source of truth for database state
- For data migrations (not schema), use `drizzle-kit generate --custom`

**Detection:** Git diff showing manual edits to `drizzle/` migration SQL files. Schema drift between TypeScript definitions and actual database.

**Applies to phase:** Migration strategy, CI/CD setup

### Pitfall 6: Migration Race Condition With Multiple Services

**What goes wrong:** Multiple services in Docker Compose start simultaneously, each running migrations against the same PostgreSQL instance. Even with per-service schemas, concurrent `CREATE SCHEMA` or extension operations can conflict.

**Why it happens:** Putting `migrate()` in `main.ts` bootstrap seems convenient. Docker Compose starts all services roughly in parallel after `postgres` is healthy.

**Consequences:** Service instances crash-loop on startup. Partial migration leaves database in inconsistent state. "relation already exists" errors.

**Prevention:**
- For local dev (single instance): `migrate()` in `main.ts` is acceptable but each service must only migrate its own schema
- For production: Run migrations as a separate job/init-container before deploying services
- Consider a migration service or script that runs per-service migrations sequentially
- Keep this in mind now even though current deployment is single-instance Docker Compose

**Detection:** Multiple services logging migration errors simultaneously. "relation already exists" errors.

**Applies to phase:** Migration strategy, Docker Compose setup

## Moderate Pitfalls

### Pitfall 7: PostgreSQL Schema Not Auto-Created

**What goes wrong:** Drizzle schemas use `pgSchema('auth')` to namespace tables. The first migration expects the `auth` schema to exist. If it doesn't, migration fails with `schema "auth" does not exist`.

**Why it happens:** The `CREATE SCHEMA` statement must execute before any `CREATE TABLE`. Drizzle-kit may or may not include it in generated SQL depending on when `pgSchema` was introduced.

**Prevention:**
- Define `pgSchema()` from the very first schema file, before any tables
- Verify the first generated migration includes `CREATE SCHEMA IF NOT EXISTS "auth"`
- If missing, add `CREATE SCHEMA IF NOT EXISTS` as a database init script in Docker Compose
- Alternative: init SQL in `docker-compose.yml` via postgres image's `/docker-entrypoint-initdb.d/`

**Detection:** Migration failure with `schema "auth" does not exist`. Tables created in `public` schema instead.

**Applies to phase:** Schema definition, Docker Compose

### Pitfall 8: JSONB as Escape Hatch from Normalization

**What goes wrong:** Developers store complex nested objects as JSONB columns to avoid relational schema design. "It worked like MongoDB documents." 45% of failed MongoDB-to-PostgreSQL migrations make this mistake.

**Why it happens:** Coming from MongoDB, the document-model mindset persists. JSONB feels familiar and initially faster.

**Prevention:**
- JSONB is valid ONLY for truly schemaless data: user preferences, metadata blobs, audit context
- For business entities with known structure (campaigns, recipients, groups), normalize into tables
- Rule of thumb: if you query/filter by a field, it must be a column, not nested in JSONB
- The migration rationale states "relational data (campaigns -> groups -> recipients)" -- honor it

**Applies to phase:** Schema definition

### Pitfall 9: Missing Foreign Key Indexes

**What goes wrong:** Drizzle creates FK constraints but does NOT auto-create indexes on FK columns (unlike some ORMs). JOINs and cascading operations become progressively slower.

**Prevention:**
- Always add explicit indexes on foreign key columns:
  ```typescript
  export const recipients = audienceSchema.table('recipients', {
    groupId: text('group_id').references(() => groups.id),
  }, (table) => [
    index('idx_recipients_group_id').on(table.groupId),
  ]);
  ```
- Include index review in schema PR checklist

**Applies to phase:** Schema definition

### Pitfall 10: Transaction Boundaries Without Unit of Work Pattern

**What goes wrong:** Each repository method creates its own transaction. Use cases needing multiple repository operations can't wrap them in a single transaction. Partial writes on failure.

**Why it happens:** Repository pattern in Clean Architecture hides database details. Transaction boundaries span multiple repositories -- an infrastructure concern that doesn't fit neatly into individual ports.

**Prevention:**
- Define a `UnitOfWork` port interface in the application layer
- Implement with Drizzle's `db.transaction()` in infrastructure
- Pass transaction context through the unit of work to repositories
- Drizzle supports nested transactions via savepoints for complex operations
- Design repository port interfaces to accept optional transaction context even in stub phase

**Applies to phase:** Repository adapter design (design interface now, implement with business logic later)

### Pitfall 11: Health Indicator DI Mismatch Across Services

**What goes wrong:** `PostgresHealthIndicator` injects `DRIZZLE` or `PG_POOL` token. Services that do NOT use DrizzleModule (gateway, notifier) cannot import it because the provider doesn't exist in their DI container.

**Why it happens:** Current `MongoHealthIndicator` is a stub that doesn't connect to anything. The new PostgreSQL indicator requires a live pool instance.

**Prevention:**
- Gateway and notifier health modules must NOT include `PostgresHealthIndicator`
- Only services importing `DrizzleModule.forRoot()` wire the PostgreSQL health indicator
- Keep health module configuration per-service so each only checks its own dependencies

**Detection:** `Nest cannot resolve dependencies of PostgresHealthIndicator` errors in gateway or notifier.

**Applies to phase:** Health check update

### Pitfall 12: drizzle-kit Config Path Resolution in Monorepo

**What goes wrong:** `drizzle.config.ts` uses relative paths for `schema` and `out`. When run from different working directories in a monorepo, path resolution breaks.

**Why it happens:** drizzle-kit resolves paths relative to execution directory, not config file location. In pnpm workspace, execution context varies.

**Prevention:**
- Place `drizzle.config.ts` in each service root (`apps/auth/drizzle.config.ts`)
- Use paths relative to that location
- pnpm scripts in each service's `package.json`: `"db:generate": "drizzle-kit generate"`
- Always run from service directory, never from monorepo root

**Detection:** "No schema files found" errors. Migration files in unexpected locations.

**Applies to phase:** Project setup, migration strategy

### Pitfall 13: Driver Confusion (postgres.js vs node-postgres)

**What goes wrong:** Two PostgreSQL drivers exist with different APIs. Copy-pasting from tutorials leads to mixing `postgres` (postgres.js) and `pg` (node-postgres). The Drizzle adapter imports are different and not interchangeable.

**Prevention:**
- Pick ONE driver and enforce it via foundation module
- If postgres.js: `import { drizzle } from 'drizzle-orm/postgres-js'` + `import postgres from 'postgres'`
- If node-postgres: `import { drizzle } from 'drizzle-orm/node-postgres'` + `import { Pool } from 'pg'`
- Document the choice in CLAUDE.md conventions
- node-postgres is better for NestJS because: Pool management built-in, wider ecosystem support, easier shutdown (`pool.end()`)

**Detection:** Both `postgres` and `pg` appearing in `pnpm-lock.yaml`.

**Applies to phase:** Initial setup

### Pitfall 14: drizzle-orm and drizzle-kit Version Mismatch

**What goes wrong:** drizzle-kit and drizzle-orm have different internal schema representations across versions. Mismatched versions cause migration generation failures or phantom diffs on unchanged schemas.

**Prevention:**
- Always update drizzle-orm and drizzle-kit together in the same commit
- Pin both with tilde versions (`~0.45.2`, `~0.31.10`) -- no caret `^` given Drizzle's beta stability
- Test migration generation after every version bump

**Detection:** "Unsupported schema version" errors. Migration diffs appearing for unchanged schemas.

**Applies to phase:** Initial setup, ongoing dependency management

### Pitfall 15: push vs generate vs migrate Confusion

**What goes wrong:** Team uses `drizzle-kit push` in production, or mixes workflows, causing schema state to diverge from migration history.

**Prevention:**
- `drizzle-kit push` -- LOCAL DEVELOPMENT ONLY. Directly syncs schema, no files
- `drizzle-kit generate` -- Creates SQL migration files. Commit to git
- `drizzle-kit migrate` -- Runs migration files. Use in CI/CD and production
- Enforce via pnpm scripts: `db:push` (dev), `db:generate` (creates files), `db:migrate` (runs files)
- NEVER use `push` against shared or production databases

**Applies to phase:** Migration strategy

## Minor Pitfalls

### Pitfall 16: Using serial Instead of Identity Columns or Application IDs

**What goes wrong:** `serial()` for auto-increment IDs -- deprecated by PostgreSQL community since PG 10+. Integer IDs don't work well across microservices.

**Prevention:**
- Domain entities already use `string` IDs -- maintain this in Drizzle schema with `text` PKs
- Use application-generated IDs: NanoID (3.7M ops/sec, URL-safe) or UUIDv7 (time-sortable, better B-tree indexing)
- If auto-increment needed: `integer().generatedAlwaysAsIdentity()` not `serial()`

**Applies to phase:** Schema definition

### Pitfall 17: Missing .notNull() on Required Columns

**What goes wrong:** Drizzle defaults columns to nullable. Forgetting `.notNull()` allows NULL where domain expects required values.

**Prevention:** Convention: every column `.notNull()` unless explicitly nullable. Domain entity constructors indicate which fields are required -- schema must match.

**Applies to phase:** Schema definition

### Pitfall 18: Timestamp Mode and Timezone Inconsistency

**What goes wrong:** Default string mode for timestamp columns. String-to-Date conversions everywhere. Different services handle timezones differently.

**Prevention:**
- Use `timestamp('created_at', { mode: 'date', precision: 3, withTimezone: true })` consistently
- Date mode is 10-15% faster than string mode
- All timestamps in UTC. Application layer handles display

**Applies to phase:** Schema definition

### Pitfall 19: Connection Pool Size Multiplied Across Services

**What goes wrong:** Default pool size (10) times 4 services = 40 connections. With restarts and health checks, hits PostgreSQL's 100 limit.

**Prevention:**
- Set explicit `max` pool size per service (start with 5)
- Configure PostgreSQL `max_connections` in Docker Compose (200+ for dev)
- Expose as env var: `DATABASE_POOL_MAX`
- Monitor `pg_stat_activity`

**Applies to phase:** Config, Docker Compose

### Pitfall 20: Docker Compose MongoDB References Left Behind

**What goes wrong:** MongoDB service removed but references remain: `depends_on: mongodb`, volume `mongo_data`, `.env.docker` still has `MONGODB_URI`. Services fail to start.

**Prevention:**
- Systematic grep for: `mongodb`, `mongo`, `MONGODB_URI`, `MongoHealth`
- Update: `docker-compose.yml`, `.env.docker`, `env-schema.ts`, `infrastructure.ts`, health imports, all `*.module.ts`
- Replace `mongo:7` with `postgres:16-alpine`
- Replace healthcheck: `pg_isready -U postgres`
- Replace volume: `mongo_data` -> `postgres_data`

**Detection:** Docker Compose waiting for nonexistent `mongodb` service. Zod validation error for missing `DATABASE_URL`.

**Applies to phase:** Docker Compose migration (early phase)

### Pitfall 21: Not Selecting Specific Fields in Queries

**What goes wrong:** `db.select().from(table)` everywhere returns all columns. Over-fetching.

**Prevention:** Repository methods select only needed columns. Maps to Clean Architecture: each use case defines exactly what it needs via its port.

**Applies to phase:** Repository implementation

### Pitfall 22: Forgetting to Export All Schema Files for drizzle-kit

**What goes wrong:** Schema across multiple files but not all exported from entry point. `drizzle-kit generate` silently omits tables.

**Prevention:** Each service's schema directory has barrel `index.ts` re-exporting everything. Verify generated SQL after every `generate`.

**Applies to phase:** Schema definition

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Severity | Mitigation |
|-------------|---------------|----------|------------|
| Config/env update | Pitfall 20: MongoDB leftovers | Minor | Systematic grep for all MongoDB references |
| Config/env update | Pitfall 20: .env.docker drift | Minor | Change env-schema + .env.docker atomically |
| Docker Compose | Pitfall 19: Pool exhaustion | Minor | Set pool sizes, increase max_connections |
| Docker Compose | Pitfall 4: No pool cleanup | Critical | OnApplicationShutdown with pool.end() |
| Docker Compose | Pitfall 6: Boot migration race | Critical | Separate migration step from bootstrap |
| Drizzle module | Pitfall 3: Eager connection | Critical | Async factory with ConfigService DI |
| Drizzle module | Pitfall 13: Driver confusion | Moderate | Pick one driver, enforce via foundation |
| Drizzle module | Pitfall 14: Version mismatch | Moderate | Pin drizzle-orm + drizzle-kit together |
| Schema definition | Pitfall 1: Schema in domain | Critical | Strict placement in infrastructure/, ESLint |
| Schema definition | Pitfall 2: No schema isolation | Critical | pgSchema per service from day one |
| Schema definition | Pitfall 7: Schema not created | Moderate | Verify CREATE SCHEMA in first migration |
| Schema definition | Pitfall 8: JSONB escape hatch | Moderate | Normalize relational business data |
| Schema definition | Pitfall 9: Missing FK indexes | Moderate | Index checklist for every FK |
| Migration strategy | Pitfall 5: Editing migrations | Critical | Never edit, always regenerate |
| Migration strategy | Pitfall 12: Path resolution | Moderate | Per-service drizzle.config.ts |
| Migration strategy | Pitfall 15: push in production | Moderate | push=dev, generate+migrate=prod |
| Repository impl | Pitfall 10: No UnitOfWork | Moderate | Design UoW port interface now |
| Health checks | Pitfall 11: DI mismatch | Moderate | Only wire PG health in services with DrizzleModule |

## Drizzle-Specific Risk: Project Maintenance Pace

**Confidence: LOW (monitoring concern, not a blocker)**

As of late 2025, the Drizzle ORM GitHub repository showed signs of reduced maintainer engagement (1,378 open issues, 250 open PRs, limited commit activity). The core query builder and migration tooling are stable and production-ready, but:

- Pin Drizzle version explicitly (no `^` prefix)
- Avoid relying on bleeding-edge or undocumented features
- v1.0.0-beta releases have known edge-case bugs (VARCHAR to CITEXT, snake_case constraints)
- Contingency awareness: Kysely is the closest alternative SQL-first query builder

This does not affect the migration decision. Drizzle's approach (TypeScript schema as source of truth, SQL-like query builder, lightweight runtime) is the right fit for this project's Clean Architecture constraints.

## Sources

- [Drizzle ORM - Schema Declaration](https://orm.drizzle.team/docs/sql-schema-declaration) -- pgSchema, table definitions
- [Drizzle ORM - Migrations](https://orm.drizzle.team/docs/migrations) -- generate vs push vs migrate
- [Drizzle ORM - Transactions](https://orm.drizzle.team/docs/transactions) -- nested transactions, savepoints
- [NestJS & DrizzleORM: A Great Match - Trilon](https://trilon.io/blog/nestjs-drizzleorm-a-great-match) -- NestJS integration patterns, lifecycle
- [Drizzle ORM PostgreSQL Best Practices (2025)](https://gist.github.com/productdevbook/7c9ce3bbeb96b3fabc3c7c2aa2abc717) -- identity columns, connection pooling, indexing
- [3 Biggest Mistakes with Drizzle ORM](https://medium.com/@lior_amsalem/3-biggest-mistakes-with-drizzle-orm-1327e2531aff) -- migration editing, query efficiency
- [Repository Pattern in NestJS with Drizzle](https://medium.com/@vimulatus/repository-pattern-in-nest-js-with-drizzle-orm-e848aa75ecae) -- Clean Architecture mapping
- [Drizzle connection cleanup discussion](https://github.com/drizzle-team/drizzle-orm/discussions/228) -- pool.end() lifecycle
- [PostgreSQL schema-per-microservice](https://dev.to/lbelkind/does-your-microservice-deserve-its-own-database-np2) -- isolation strategies
- [Infisical: MongoDB to PostgreSQL Migration](https://infisical.com/blog/postgresql-migration-technical) -- document-to-relational pitfalls
- [Drizzle Kit overview](https://orm.drizzle.team/docs/kit-overview) -- push vs generate vs migrate workflow
- [Drizzle project health discussion](https://github.com/drizzle-team/drizzle-orm/issues/4391) -- maintenance concerns
- [NestJS Lifecycle Events](https://docs.nestjs.com/fundamentals/lifecycle-events) -- shutdown hooks
- [NestJS Dynamic Modules](https://docs.nestjs.com/fundamentals/dynamic-modules) -- provider resolution and DI context
- Direct codebase inspection of health indicators, config schema, repository stubs, Docker Compose, domain entities

---

*Pitfalls research: 2026-04-04*
