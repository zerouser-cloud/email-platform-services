# Phase 12: Auth Schema & Repository (Reference) - Research

**Researched:** 2026-04-04
**Domain:** Drizzle ORM pgSchema, drizzle-kit migrations, repository adapter pattern in Clean/Hexagonal NestJS
**Confidence:** HIGH

## Summary

Phase 12 wires the auth service to PostgreSQL via Drizzle ORM. The work spans four layers: (1) Drizzle schema definition using `pgSchema('auth')` for namespace isolation, (2) drizzle-kit configuration and migration generation, (3) a mapper that converts between Drizzle rows and domain entities, (4) a repository adapter implementing `UserRepositoryPort` via Drizzle queries. All Drizzle types stay in `infrastructure/persistence/` -- domain and application layers remain untouched.

The Foundation PersistenceModule from Phase 10 is already built and exports `DRIZZLE`, `PG_POOL`, and `DATABASE_HEALTH` tokens. Auth module needs to import `PersistenceModule.forRootAsync()`, register `PgUserRepository` as the `UserRepositoryPort` provider, and wire `DATABASE_HEALTH` into the health controller. The `infrastructure/persistence/` directory exists but is empty -- all files are new.

**Primary recommendation:** Follow the exact patterns below. Every import path, type, and API call has been verified against Drizzle 0.45.2 official docs and the actual Phase 10 codebase. This is the reference implementation -- Phase 13 replicates it mechanically.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Minimal schema sufficient to validate the full pattern (pgSchema -> table -> migration -> repository -> mapper). This is a foundation proof, not final business model.
- **D-02:** `pgSchema('auth')` for namespace isolation. Table: `auth.users` with columns: id (uuid PK), email (varchar unique), password_hash (varchar), role (varchar), organization (varchar), team (varchar), created_at (timestamp), updated_at (timestamp).
- **D-03:** `password_hash` stays in schema only, NOT in domain entity. User entity maps only business fields (id, email, role, organization, team). Login/auth concerns handled through separate port methods later.
- **D-04:** ID strategy: UUID v4 via `crypto.randomUUID()`. PostgreSQL `uuid` type. Default generated in app, not DB.
- **D-05:** `created_at` and `updated_at` default to `now()` in schema. Not mapped to domain entity (audit/infra concern).
- **D-06:** Use `drizzle-kit generate` + `drizzle-kit migrate` (not `push`). Generates SQL migration files for traceability.
- **D-07:** `drizzle.config.ts` in `apps/auth/` root. Scoped to auth pgSchema only. DATABASE_URL from env.
- **D-08:** Install `drizzle-kit` as devDependency in `apps/auth/` (not in foundation -- each service manages its own migrations).
- **D-09:** Migration files output to `apps/auth/drizzle/` directory.
- **D-10:** Mapper file at `apps/auth/src/infrastructure/persistence/user.mapper.ts`. Two functions: `toDomain(row)` -> User entity, `toPersistence(user)` -> insert object.
- **D-11:** Drizzle types (`$inferSelect`, `$inferInsert`, table references) only in infrastructure/persistence/. Domain and application import nothing from Drizzle.
- **D-12:** `PgUserRepository` at `apps/auth/src/infrastructure/persistence/pg-user.repository.ts`. Implements `UserRepositoryPort` interface. Injects `DRIZZLE` token from PersistenceModule.
- **D-13:** Repository methods use Drizzle query API (select, insert, eq) with mappers for conversion.
- **D-14:** Auth module imports `PersistenceModule.forRootAsync()` and registers `{ provide: 'UserRepositoryPort', useClass: PgUserRepository }`.
- **D-15:** Health module gets database health via PersistenceModule (DATABASE_HEALTH token already exported).

### Claude's Discretion
- Exact column lengths (varchar(255) etc.)
- Whether to add indexes beyond unique email
- Exact drizzle-kit script names in package.json

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCHM-01 | Drizzle schema per service with pgSchema isolation | `pgSchema('auth')` API verified. Import from `drizzle-orm/pg-core`. `.table()` method creates tables within schema. See Architecture Patterns section. |
| SCHM-02 | drizzle-kit config and migration workflow configured | `defineConfig()` from `drizzle-kit` verified. `schemaFilter`, `migrations.schema`, `dbCredentials.url` all confirmed. See Code Examples section. |
| SCHM-03 | Drizzle types do not leak into domain layer -- mapping only in infrastructure | `$inferSelect` / `$inferInsert` types used only in mapper file. Repository returns domain `User` entity. See Mapper Pattern. |
| REPO-01 | Auth repository adapter implemented with Drizzle (reference implementation) | `db.select().from()`, `db.insert().values()`, `eq()` operators verified. `NodePgDatabase` type for injection. See Repository Pattern. |
</phase_requirements>

## Standard Stack

### Core (installed in apps/auth)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `drizzle-orm` | 0.45.2 | Schema definition + query builder in repository | Already in foundation. Auth needs it for `pgSchema`, `pgTable`, column types, and `eq` operator in repository. |
| `drizzle-kit` | 0.31.10 | Migration CLI (generate, migrate) | devDependency per service. Generates SQL migration files from schema diff. |

### Already Available (from foundation/workspace)

| Library | Version | Purpose | Already In |
|---------|---------|---------|------------|
| `drizzle-orm` | 0.45.2 | `NodePgDatabase` type, `drizzle()` factory | `@email-platform/foundation` |
| `pg` | 8.20.0 | PostgreSQL Pool driver | `@email-platform/foundation` |
| `@nestjs/terminus` | 11.1.1 | Health check infrastructure | `@email-platform/auth` |

**Installation:**
```bash
pnpm --filter @email-platform/auth add drizzle-orm
pnpm --filter @email-platform/auth add -D drizzle-kit
```

**Version verification:** All versions confirmed via `npm view` on 2026-04-04.

**Why auth needs its own drizzle-orm:** The schema file (`users.schema.ts`) imports `pgSchema`, `uuid`, `varchar`, `timestamp` from `drizzle-orm/pg-core`. The repository imports `eq` from `drizzle-orm`. These are direct dependencies of auth's infrastructure layer, not transitive through foundation.

## Architecture Patterns

### Recommended File Structure

```
apps/auth/
  drizzle.config.ts                          # drizzle-kit CLI config (D-07)
  drizzle/                                   # Migration output dir (D-09)
    0000_*.sql                               # Generated migration files
    meta/                                    # drizzle-kit metadata
  src/
    domain/
      entities/
        user.entity.ts                       # UNCHANGED (5 fields)
    application/
      ports/
        outbound/
          user-repository.port.ts            # UNCHANGED (findByEmail, save)
    infrastructure/
      persistence/
        schema/
          users.schema.ts                    # pgSchema + table definition
          index.ts                           # Barrel for drizzle-kit
        user.mapper.ts                       # toDomain / toPersistence
        pg-user.repository.ts                # PgUserRepository
    health/
      health.module.ts                       # ADD: PersistenceModule import
      health.controller.ts                   # ADD: DATABASE_HEALTH injection
  auth.module.ts                             # ADD: PersistenceModule + PgUserRepository
```

### Pattern 1: pgSchema Table Definition

**What:** Define PostgreSQL schema and table using Drizzle's `pgSchema` API.
**When to use:** Every service that owns data creates its own pgSchema.

```typescript
// apps/auth/src/infrastructure/persistence/schema/users.schema.ts
// Source: https://orm.drizzle.team/docs/schemas
import { pgSchema, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';

export const authSchema = pgSchema('auth');

export const users = authSchema.table('users', {
  id: uuid('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  organization: varchar('organization', { length: 255 }).notNull(),
  team: varchar('team', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

**Key details:**
- `pgSchema('auth')` creates the `auth` PostgreSQL schema. Generated SQL: `CREATE SCHEMA IF NOT EXISTS "auth"`.
- `authSchema.table('users', ...)` creates `auth.users`. All queries are schema-prefixed: `SELECT * FROM "auth"."users"`.
- `uuid('id')` maps to PostgreSQL `uuid` type. No `.defaultRandom()` -- app generates IDs (D-04).
- `varchar('email', { length: 255 })` -- explicit length constraint.
- `passwordHash` as camelCase JS property maps to `password_hash` snake_case DB column via the string argument.
- `timestamp('created_at').defaultNow()` -- DB generates default on insert.

### Pattern 2: Schema Barrel Export

```typescript
// apps/auth/src/infrastructure/persistence/schema/index.ts
export { authSchema, users } from './users.schema';
```

**Why barrel:** drizzle-kit config points to this file. Also used by drizzle-kit to discover all tables in the schema.

### Pattern 3: Type Inference from Schema Tables

```typescript
// Types derived from the table -- ONLY used in infrastructure/persistence/
import type { users } from './schema/users.schema';

// Select type: what you get back from a SELECT query
type UserRow = typeof users.$inferSelect;
// Equivalent: { id: string; email: string; passwordHash: string; role: string; organization: string; team: string; createdAt: Date; updatedAt: Date }

// Insert type: what you pass to INSERT (optional fields have defaults)
type NewUserRow = typeof users.$inferInsert;
// Equivalent: { id: string; email: string; passwordHash: string; role: string; organization: string; team: string; createdAt?: Date; updatedAt?: Date }
```

**Alternative import syntax (equivalent):**
```typescript
import { InferSelectModel, InferInsertModel } from 'drizzle-orm';
type UserRow = InferSelectModel<typeof users>;
type NewUserRow = InferInsertModel<typeof users>;
```

**Use `$inferSelect` style** -- it is shorter and does not require an extra import from `drizzle-orm`.

### Pattern 4: Mapper (toDomain / toPersistence)

**What:** Explicit bidirectional mapping between Drizzle row types and domain entities.
**When to use:** Every repository adapter uses a mapper. Drizzle types stay in the mapper file.

```typescript
// apps/auth/src/infrastructure/persistence/user.mapper.ts
import { User } from '../../domain/entities/user.entity';
import type { users } from './schema/users.schema';

type UserRow = typeof users.$inferSelect;
type NewUserRow = typeof users.$inferInsert;

export const UserMapper = {
  toDomain(row: UserRow): User {
    return new User(
      row.id,
      row.email,
      row.role,
      row.organization,
      row.team,
    );
  },

  toPersistence(user: User, passwordHash: string): NewUserRow {
    return {
      id: user.id,
      email: user.email,
      passwordHash,
      role: user.role,
      organization: user.organization,
      team: user.team,
    };
  },
};
```

**Key design decisions:**
- `toDomain` skips `passwordHash`, `createdAt`, `updatedAt` -- they are not in the domain entity (D-03, D-05).
- `toPersistence` accepts `passwordHash` as a separate argument -- the domain entity does not carry it, but the DB row requires it.
- `createdAt` / `updatedAt` omitted from insert object -- DB defaults via `defaultNow()`.
- `UserMapper` is a plain object with static functions, not a class. No DI needed -- it is a pure data transformer.

### Pattern 5: Repository Adapter

**What:** Implements the `UserRepositoryPort` interface using Drizzle query builder.
**When to use:** Every service's repository adapter follows this pattern.

```typescript
// apps/auth/src/infrastructure/persistence/pg-user.repository.ts
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '@email-platform/foundation';
import type { UserRepositoryPort } from '../../application/ports/outbound/user-repository.port';
import type { User } from '../../domain/entities/user.entity';
import { users } from './schema/users.schema';
import { UserMapper } from './user.mapper';

@Injectable()
export class PgUserRepository implements UserRepositoryPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return UserMapper.toDomain(row);
  }

  async save(user: User): Promise<void> {
    await this.db
      .insert(users)
      .values(UserMapper.toPersistence(user, ''))
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: user.email,
          role: user.role,
          organization: user.organization,
          team: user.team,
          updatedAt: new Date(),
        },
      });
  }
}
```

**Key details:**
- `NodePgDatabase` imported as **type** from `drizzle-orm/node-postgres`. No schema generic needed -- `db.select().from(table)` works without it.
- `DRIZZLE` Symbol token imported from `@email-platform/foundation`.
- `eq` imported from `drizzle-orm` (not `drizzle-orm/pg-core`).
- `select().from(users)` returns rows typed as `typeof users.$inferSelect` automatically.
- `onConflictDoUpdate` on `target: users.id` implements upsert. `updatedAt` set explicitly on update.
- `save()` passes empty string for `passwordHash` -- this is a stub. Real password handling is deferred.

### Pattern 6: NodePgDatabase Typing

**What:** The correct type for injecting the Drizzle instance.

```typescript
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

// Without schema generic -- works for select().from(table) API
@Inject(DRIZZLE) private readonly db: NodePgDatabase

// With schema generic -- needed ONLY for db.query.* relational API
@Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof import('./schema')>
```

**Recommendation:** Use `NodePgDatabase` without generic. The `select().from()` API works fine without it. The relational query API (`db.query.users.findFirst()`) requires the generic but is unnecessary -- all our queries use the SQL-like API.

### Pattern 7: Module Wiring

```typescript
// apps/auth/src/auth.module.ts -- UPDATED
import { Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { AppConfigModule } from '@email-platform/config';
import { LoggingModule, PersistenceModule } from '@email-platform/foundation';
import { AuthGrpcServer } from './infrastructure/grpc/auth.grpc-server';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { PgUserRepository } from './infrastructure/persistence/pg-user.repository';
import { HealthModule } from './health/health.module';

export const USER_REPOSITORY_PORT = 'UserRepositoryPort';
export const LOGIN_PORT = 'LoginPort';

@Module({
  imports: [
    AppConfigModule,
    PersistenceModule.forRootAsync(),    // NEW: provides DRIZZLE + DATABASE_HEALTH
    LoggingModule.forGrpcAsync('auth'),
    HealthModule,
  ],
  controllers: [AuthGrpcServer],
  providers: [
    { provide: USER_REPOSITORY_PORT, useClass: PgUserRepository },  // NEW
    { provide: LOGIN_PORT, useClass: LoginUseCase },
  ],
})
export class AuthModule implements OnModuleDestroy {
  private readonly logger = new Logger(AuthModule.name);

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down auth service...');
  }
}
```

### Pattern 8: Health Module Wiring

```typescript
// apps/auth/src/health/health.module.ts -- UPDATED
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
})
export class HealthModule {}
```

**Note:** HealthModule does NOT need to import PersistenceModule. The `DATABASE_HEALTH` token is already available because `PersistenceModule.forRootAsync()` is imported in `AuthModule` (the parent), and `PostgresHealthModule` exports `DATABASE_HEALTH`. Since `HealthModule` is imported by `AuthModule`, and `PersistenceModule` is also imported by `AuthModule`, the `DATABASE_HEALTH` token is available in `AuthModule`'s scope -- but NOT directly injectable in `HealthController` unless we pass it through.

**Correct approach:** HealthModule needs the `DATABASE_HEALTH` token injected into its controller. Two options:

Option A -- Import PersistenceModule in HealthModule:
```typescript
// health.module.ts
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { PersistenceModule } from '@email-platform/foundation';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule, PersistenceModule.forRootAsync()],
  controllers: [HealthController],
})
export class HealthModule {}
```

Option B -- Re-export from AuthModule and inject via parent scope.

**Recommendation:** Option A. Import `PersistenceModule.forRootAsync()` in `HealthModule`. NestJS deduplicates module instances, so importing PersistenceModule in both AuthModule and HealthModule creates only one Pool/Drizzle instance. This makes HealthModule self-contained.

### Pattern 9: Health Controller with DATABASE_HEALTH

```typescript
// apps/auth/src/health/health.controller.ts -- UPDATED
import { Controller, Get, Inject } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { HEALTH, DATABASE_HEALTH } from '@email-platform/foundation';
import type { DatabaseHealthIndicator } from '@email-platform/foundation';

@Controller(HEALTH.ROUTE)
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    @Inject(DATABASE_HEALTH) private readonly db: DatabaseHealthIndicator,
  ) {}

  @Get(HEALTH.LIVE)
  @HealthCheck()
  liveness() {
    return this.health.check([]);
  }

  @Get(HEALTH.READY)
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.db.isHealthy(HEALTH.INDICATOR.POSTGRESQL),
    ]);
  }
}
```

**Key details:**
- `DATABASE_HEALTH` is a Symbol token -- imported from `@email-platform/foundation`.
- `DatabaseHealthIndicator` imported as **type** -- the controller never knows it is PostgreSQL.
- Readiness check calls `this.db.isHealthy('postgresql')` -- liveness stays empty (no DB dependency for liveness).
- `HEALTH.INDICATOR.POSTGRESQL` is `'postgresql'` -- already in health constants.

### Pattern 10: drizzle.config.ts

```typescript
// apps/auth/drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infrastructure/persistence/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  schemaFilter: ['auth'],
  migrations: {
    table: '__drizzle_migrations',
    schema: 'auth',
  },
});
```

**Key details:**
- `schema` points to the barrel export file containing all table definitions.
- `out: './drizzle'` produces `apps/auth/drizzle/` directory (D-09).
- `schemaFilter: ['auth']` -- drizzle-kit only manages the `auth` PostgreSQL schema. Other schemas are untouched.
- `migrations.schema: 'auth'` -- the `__drizzle_migrations` tracking table lives inside the `auth` schema, not `public`. No collision between services.
- `dbCredentials.url` reads `DATABASE_URL` from environment. The `!` non-null assertion is safe -- drizzle-kit is a CLI tool run manually, not at runtime.

### Anti-Patterns to Avoid

- **Domain importing Drizzle types:** `InferSelectModel`, `pgTable`, `eq` must NEVER appear in `domain/` or `application/`. Only in `infrastructure/persistence/`.
- **Repository returning Drizzle rows:** Always map to domain entity via `UserMapper.toDomain()`.
- **Injecting NodePgDatabase with schema generic:** Unnecessary complexity. `NodePgDatabase` (no generic) works for `select().from()` API.
- **Using drizzle-kit push for migration management:** Use `generate` + `migrate` for traceable SQL files (D-06).
- **Putting drizzle.config.ts inside src/:** It belongs at `apps/auth/` root -- it is a CLI config, not application code.
- **Cross-service schema references:** Never import from another service's schema files.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Row-to-entity mapping types | Manual type definitions | `$inferSelect` / `$inferInsert` from table | Auto-generated, always in sync with schema |
| Upsert logic | Manual SELECT + INSERT/UPDATE | `onConflictDoUpdate()` | Single atomic query, handles races |
| Schema namespace isolation | Manual `CREATE SCHEMA` SQL | `pgSchema('auth')` | Drizzle handles SQL generation, migration tracking |
| Migration file generation | Hand-written SQL | `drizzle-kit generate` | Diffs schema against DB state, generates minimal SQL |
| Health indicator DI | Custom provider wiring | `DATABASE_HEALTH` Symbol token from PersistenceModule | Already built in Phase 10 |

## Common Pitfalls

### Pitfall 1: Forgetting to Install drizzle-orm in the App Package
**What goes wrong:** Schema file imports from `drizzle-orm/pg-core` fail to resolve. TypeScript compilation error.
**Why it happens:** `drizzle-orm` is in `packages/foundation` but auth's schema files need it as a direct dependency.
**How to avoid:** Run `pnpm --filter @email-platform/auth add drizzle-orm` before creating schema files.
**Warning signs:** `Cannot find module 'drizzle-orm/pg-core'` TypeScript error.

### Pitfall 2: PersistenceModule Not Available in HealthModule Scope
**What goes wrong:** `DATABASE_HEALTH` injection fails in HealthController -- NestJS DI error.
**Why it happens:** `PersistenceModule` is imported in `AuthModule`, but `HealthModule` is a child module with its own scope. DI tokens from sibling imports are not automatically available.
**How to avoid:** Import `PersistenceModule.forRootAsync()` directly in `HealthModule`. NestJS deduplicates -- only one Pool instance is created.
**Warning signs:** `Nest can't resolve dependencies of HealthController (HealthCheckService, ?)`.

### Pitfall 3: schemaFilter Missing in drizzle-kit Config
**What goes wrong:** `drizzle-kit generate` tries to manage ALL schemas in the database, not just `auth`. Migration files include other services' tables.
**Why it happens:** `schemaFilter` defaults to all schemas if not specified.
**How to avoid:** Always include `schemaFilter: ['auth']` in the service's drizzle.config.ts.
**Warning signs:** Migration files contain tables from other services.

### Pitfall 4: camelCase vs snake_case Column Mapping Confusion
**What goes wrong:** TypeScript property is `passwordHash` but DB column is `password_hash`. Queries fail or return `undefined`.
**Why it happens:** Drizzle uses the first string argument to `varchar('password_hash')` as the DB column name, and the object key `passwordHash` as the TypeScript property name.
**How to avoid:** Always provide the DB column name as the string argument: `passwordHash: varchar('password_hash', ...)`. The camelCase key is the TS property; the string is the SQL column.
**Warning signs:** `undefined` values when reading rows, or SQL errors about unknown columns.

### Pitfall 5: $inferSelect Type Includes All Columns
**What goes wrong:** The mapper tries to pass `passwordHash` to the `User` constructor, or the domain entity gains persistence-only fields.
**Why it happens:** `$inferSelect` includes ALL columns (id, email, passwordHash, createdAt, updatedAt). The mapper must explicitly select which fields map to the domain entity.
**How to avoid:** The `toDomain()` mapper picks only the 5 domain fields. Never spread the full row into the entity constructor.
**Warning signs:** TypeScript errors about extra properties, or domain entity carrying `passwordHash`.

### Pitfall 6: save() Needs passwordHash But Domain Entity Doesn't Have It
**What goes wrong:** `toPersistence(user)` cannot fill `passwordHash` because `User` entity has no such field.
**Why it happens:** D-03 explicitly excludes `passwordHash` from the domain entity. But the DB column is NOT NULL.
**How to avoid:** `toPersistence` accepts `passwordHash` as a separate parameter. The `save()` method in the repository passes it. For the reference implementation (stub), an empty string is acceptable. Real password handling is deferred.
**Warning signs:** Runtime SQL error: `null value in column "password_hash" violates not-null constraint`.

## Code Examples

### Complete Schema File (verified)

```typescript
// apps/auth/src/infrastructure/persistence/schema/users.schema.ts
// Source: https://orm.drizzle.team/docs/schemas + https://orm.drizzle.team/docs/column-types/pg
import { pgSchema, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';

export const authSchema = pgSchema('auth');

export const users = authSchema.table('users', {
  id: uuid('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  organization: varchar('organization', { length: 255 }).notNull(),
  team: varchar('team', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### Complete Mapper File (verified)

```typescript
// apps/auth/src/infrastructure/persistence/user.mapper.ts
import { User } from '../../domain/entities/user.entity';
import type { users } from './schema/users.schema';

type UserRow = typeof users.$inferSelect;
type NewUserRow = typeof users.$inferInsert;

export const UserMapper = {
  toDomain(row: UserRow): User {
    return new User(
      row.id,
      row.email,
      row.role,
      row.organization,
      row.team,
    );
  },

  toPersistence(user: User, passwordHash: string): NewUserRow {
    return {
      id: user.id,
      email: user.email,
      passwordHash,
      role: user.role,
      organization: user.organization,
      team: user.team,
    };
  },
};
```

### Complete Repository File (verified)

```typescript
// apps/auth/src/infrastructure/persistence/pg-user.repository.ts
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '@email-platform/foundation';
import type { UserRepositoryPort } from '../../application/ports/outbound/user-repository.port';
import type { User } from '../../domain/entities/user.entity';
import { users } from './schema/users.schema';
import { UserMapper } from './user.mapper';

@Injectable()
export class PgUserRepository implements UserRepositoryPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return UserMapper.toDomain(row);
  }

  async save(user: User): Promise<void> {
    await this.db
      .insert(users)
      .values(UserMapper.toPersistence(user, ''))
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: user.email,
          role: user.role,
          organization: user.organization,
          team: user.team,
          updatedAt: new Date(),
        },
      });
  }
}
```

### drizzle-kit CLI Commands

```bash
# Generate migration from schema diff (run from apps/auth/)
pnpm drizzle-kit generate

# Apply migrations to running PostgreSQL (run from apps/auth/)
pnpm drizzle-kit migrate

# With explicit config path (if running from monorepo root)
pnpm --filter @email-platform/auth exec drizzle-kit generate
pnpm --filter @email-platform/auth exec drizzle-kit migrate
```

### package.json Script Additions

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `drizzle(pool)` positional arg | `drizzle({ client: pool })` options object | Drizzle 0.30+ | Old API deprecated. Foundation already uses correct form. |
| `InferSelectModel<T>` import | `typeof table.$inferSelect` | Drizzle 0.28+ | Both work. `$inferSelect` is shorter, no extra import. |
| `HealthIndicator` base class | `HealthIndicatorService` injected | @nestjs/terminus 10+ | Foundation already uses correct form. |
| `pgTable('users', ...)` in public schema | `pgSchema('auth').table('users', ...)` | Always available | pgSchema provides namespace isolation. |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None (project constraint: no tests) |
| Config file | N/A |
| Quick run command | `pnpm --filter @email-platform/auth build` |
| Full suite command | `pnpm build` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCHM-01 | pgSchema table definition compiles | build | `pnpm --filter @email-platform/auth build` | N/A |
| SCHM-02 | drizzle-kit generates migration | CLI | `pnpm --filter @email-platform/auth exec drizzle-kit generate` | N/A |
| SCHM-03 | No Drizzle imports in domain/application | lint/grep | `grep -r "drizzle-orm" apps/auth/src/domain/ apps/auth/src/application/` returns empty | N/A |
| REPO-01 | Repository compiles with correct types | build | `pnpm --filter @email-platform/auth build` | N/A |

### Sampling Rate
- **Per task commit:** `pnpm --filter @email-platform/auth build`
- **Per wave merge:** `pnpm build` (full monorepo)
- **Phase gate:** All 6 services start, `drizzle-kit generate` produces migration, health checks pass

### Wave 0 Gaps
None -- validation is via TypeScript compilation, drizzle-kit CLI, and service startup.

## Project Constraints (from CLAUDE.md)

- **No tests:** Testing is a separate next phase. No test files.
- **No business logic:** Only structural scaffolding. Repository and mapper are structural patterns, not business logic.
- **Tech stack locked:** NestJS 11, TypeScript, gRPC -- no changes.
- **No switch/case or if/else chains:** Not applicable in this phase -- no branching logic.
- **No environment branching:** `DATABASE_URL` from config module via DI, not `process.env` in app code. Only `drizzle.config.ts` reads `process.env` directly (CLI tool, not runtime).
- **12-Factor:** Backing service (PostgreSQL) attached via config URL. Repository injected via DI port.
- **apps/ architecture:** Clean/DDD/Hexagonal. Domain and application layers untouched. All new code in infrastructure layer.
- **Barrel exports:** Schema barrel at `schema/index.ts`. No barrel needed for persistence files -- they are imported directly by auth module.

## Sources

### Primary (HIGH confidence)
- [Drizzle ORM - pgSchema docs](https://orm.drizzle.team/docs/schemas) -- pgSchema API, .table() method
- [Drizzle ORM - Column types (PostgreSQL)](https://orm.drizzle.team/docs/column-types/pg) -- uuid(), varchar(), timestamp() syntax
- [Drizzle ORM - Select API](https://orm.drizzle.team/docs/select) -- select().from(), eq(), import paths
- [Drizzle ORM - Config file reference](https://orm.drizzle.team/docs/drizzle-config-file) -- defineConfig, schemaFilter, migrations
- [Drizzle ORM - Type helpers ($inferSelect)](https://orm.drizzle.team/docs/goodies) -- $inferSelect, $inferInsert, InferSelectModel
- [Drizzle ORM - Kit overview](https://orm.drizzle.team/docs/kit-overview) -- generate, migrate CLI commands
- npm registry 2026-04-04 -- drizzle-orm 0.45.2, drizzle-kit 0.31.10

### Codebase (HIGH confidence)
- `packages/foundation/src/persistence/` -- Actual Phase 10 implementation (DrizzleModule, PersistenceModule, tokens)
- `packages/foundation/src/persistence/persistence.constants.ts` -- DRIZZLE, PG_POOL, DATABASE_HEALTH Symbols
- `packages/foundation/src/persistence/persistence.interfaces.ts` -- DatabaseHealthIndicator interface
- `packages/foundation/src/health/health-constants.ts` -- HEALTH.INDICATOR.POSTGRESQL
- `apps/auth/src/domain/entities/user.entity.ts` -- User entity (5 fields)
- `apps/auth/src/application/ports/outbound/user-repository.port.ts` -- UserRepositoryPort interface
- `apps/auth/src/auth.module.ts` -- Current module (USER_REPOSITORY_PORT token)
- `apps/auth/src/health/health.module.ts` -- Current health module (TerminusModule only)
- `apps/auth/src/health/health.controller.ts` -- Current health controller (empty checks)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- versions verified via npm registry, drizzle-orm already installed in foundation
- Architecture: HIGH -- patterns verified against Drizzle official docs, codebase Phase 10 implementation, and existing auth service structure
- Pitfalls: HIGH -- each pitfall derives from verified API behavior or NestJS DI mechanics observed in codebase

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable libraries, schema API unlikely to change)
