# Architecture: PostgreSQL + Drizzle in Clean/Hexagonal Monorepo

**Domain:** Database persistence layer migration (MongoDB to PostgreSQL + Drizzle ORM)
**Researched:** 2026-04-04
**Overall confidence:** HIGH

## Current State

The platform has a clean separation already in place:

```
apps/{service}/src/
  domain/entities/        -- Pure TS classes (User, Campaign, Recipient, ParserTask, Notification)
  application/ports/
    inbound/              -- Use case interfaces (LoginPort)
    outbound/             -- Repository interfaces (UserRepositoryPort, CampaignRepositoryPort, etc.)
  application/use-cases/  -- Use case implementations
  infrastructure/
    persistence/          -- Repository adapters (MongoUserRepository, etc.) -- ALL throw NotImplementedException
    grpc/                 -- gRPC server controllers
```

**Key observation:** All repository implementations are stubs that throw `NotImplementedException`. No actual MongoDB driver is installed or wired. This is a greenfield persistence integration -- we are implementing persistence for the first time, not migrating live data.

### Services Needing Database Access

| Service | Repository Port | Domain Entity | Needs PostgreSQL |
|---------|----------------|---------------|-----------------|
| auth | UserRepositoryPort | User | YES |
| sender | CampaignRepositoryPort | Campaign | YES |
| parser | ParserTaskRepositoryPort | ParserTask | YES |
| audience | RecipientRepositoryPort | Recipient | YES |
| notifier | NotificationSenderPort (not a repo) | Notification | NO (event consumer only) |
| gateway | None (REST facade) | None | NO (proxies to gRPC services) |

**4 services need PostgreSQL. 2 do not.**

### Current Config State

`packages/config/src/infrastructure.ts` currently defines `MONGODB_URI` in the Zod schema. Health indicators in `packages/foundation/src/health/indicators/` include `mongodb.health.ts` (stub returning "no connection configured"). The `HEALTH.INDICATOR.MONGODB` constant is used in health modules.

## Recommended Architecture

### Decision: Shared Database, Separate PostgreSQL Schemas

Use a single PostgreSQL instance with per-service PostgreSQL schemas instead of per-service databases.

**Why this approach:**
- 4 services in a single monorepo sharing the same deployment infrastructure
- Simpler connection management (one `DATABASE_URL` env var)
- PostgreSQL schemas provide logical isolation equivalent to separate databases for query purposes
- Cross-service queries possible later if needed (but discouraged by architecture constraints)
- Single backup/restore, single connection pool at infrastructure level
- Docker Compose already uses a single MongoDB instance for all services -- same pattern
- Each service's `drizzle-kit` manages only its own schema via `schemaFilter`

**Schema mapping:**
```
email_platform (database)
  auth.*          -- auth service tables (users, refresh_tokens, etc.)
  sender.*        -- sender service tables (campaigns, email_jobs, etc.)
  parser.*        -- parser service tables (parser_tasks, etc.)
  audience.*      -- audience service tables (recipients, groups, etc.)
```

### Component Placement

```
packages/
  foundation/
    src/
      database/
        drizzle.module.ts          -- NestJS DynamicModule wrapping Drizzle + pg Pool
        drizzle.constants.ts       -- DRIZZLE injection token
      health/
        indicators/
          postgresql.health.ts     -- Replaces mongodb.health.ts

apps/{service}/                    -- Only services with persistence (auth, sender, parser, audience)
  src/
    infrastructure/
      persistence/
        schema/                    -- Drizzle table definitions using pgSchema
          {entity}.schema.ts       -- e.g., users.schema.ts
          index.ts                 -- Barrel export of all schemas for that service
        migrations/                -- Generated SQL migration files (per-service, committed to repo)
        {entity}.repository.ts     -- Repository adapter using Drizzle (replaces mongo-*.repository.ts)
  drizzle.config.ts                -- Per-service drizzle-kit config (for CLI only)
```

### Layer Placement (Dependency Rule Preserved)

| Component | Layer | Rationale |
|-----------|-------|-----------|
| Domain entities (User, Campaign, etc.) | domain/ | Pure TS, zero imports. **UNCHANGED.** |
| Repository port interfaces | application/ports/outbound/ | Define what persistence looks like. **UNCHANGED.** |
| Drizzle schema definitions | infrastructure/persistence/schema/ | Framework-specific (`pgTable`, `pgSchema`). Infrastructure layer. |
| Repository implementations | infrastructure/persistence/ | Adapters implementing ports via Drizzle. Infrastructure layer. |
| DrizzleModule (shared) | packages/foundation/ | Cross-cutting infrastructure concern, same pattern as LoggingModule. |
| Migration files | infrastructure/persistence/migrations/ | Framework artifact, lives with the adapter that uses it. |
| drizzle.config.ts (per-service) | apps/{service}/ root | CLI config for drizzle-kit, used only at dev/CI time for generation. |

**Critical rule: Domain entities MUST NOT import from Drizzle.** The Drizzle schema files in `infrastructure/` map domain entities to database tables. The mapping is one-directional: infrastructure depends on domain, never the reverse.

## New Components

### 1. DrizzleModule (packages/foundation)

Located in `packages/foundation/src/database/`, following the same pattern as `LoggingModule`:

```typescript
// packages/foundation/src/database/drizzle.constants.ts
export const DRIZZLE = Symbol('DRIZZLE');
```

```typescript
// packages/foundation/src/database/drizzle.module.ts
import { DynamicModule, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from './drizzle.constants';

const PG_POOL = Symbol('PG_POOL');

@Module({})
export class DrizzleModule {
  static forRoot(): DynamicModule {
    return {
      module: DrizzleModule,
      global: true,
      providers: [
        {
          provide: PG_POOL,
          inject: [ConfigService],
          useFactory: (config: ConfigService): Pool => {
            return new Pool({
              connectionString: config.get<string>('DATABASE_URL'),
            });
          },
        },
        {
          provide: DRIZZLE,
          inject: [PG_POOL],
          useFactory: (pool: Pool): NodePgDatabase => {
            return drizzle({ client: pool });
          },
        },
      ],
      exports: [DRIZZLE],
    };
  }
}
```

**Why custom module instead of `@knaadh/nestjs-drizzle`:**
- The community package adds abstraction over what is already a 15-line wrapper
- Custom module gives full control over pool configuration, shutdown hooks, logging
- Follows existing codebase pattern (`LoggingModule.forGrpc()`, `LoggingModule.forHttp()`)
- No external dependency risk for trivial code

**Why Pool is a separate provider:**
- Enables clean shutdown (`pool.end()`) in `OnModuleDestroy`
- Health indicator can inject the pool directly for `SELECT 1` checks
- Testable -- mock pool separately from Drizzle instance

### 2. PostgreSQL Health Indicator

```typescript
// packages/foundation/src/health/indicators/postgresql.health.ts
import { Inject, Injectable } from '@nestjs/common';
import { type HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/drizzle.constants';

@Injectable()
export class PostgresHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      await this.db.execute(sql`SELECT 1`);
      return indicator.up();
    } catch {
      return indicator.down({ message: 'PostgreSQL connection failed' });
    }
  }
}
```

### 3. Per-Service Drizzle Schema (Example: auth)

```typescript
// apps/auth/src/infrastructure/persistence/schema/users.schema.ts
import { pgSchema, text, timestamp } from 'drizzle-orm/pg-core';

export const authSchema = pgSchema('auth');

export const users = authSchema.table('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  role: text('role').notNull(),
  organization: text('organization').notNull(),
  team: text('team').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

**Key points:**
- `pgSchema('auth')` creates a named PostgreSQL schema -- all tables are namespace-isolated
- Table structure mirrors domain entity properties but adds persistence concerns (timestamps)
- `text('id').primaryKey()` -- domain generates IDs, not the database (no `generatedAlwaysAsIdentity`)
- No Drizzle `InferSelectModel` types leak outside `infrastructure/`

### 4. Repository Adapter (Example: auth)

```typescript
// apps/auth/src/infrastructure/persistence/user.repository.ts
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '@email-platform/foundation';
import { User } from '../../domain/entities/user.entity';
import { UserRepositoryPort } from '../../application/ports/outbound/user-repository.port';
import { users } from './schema/users.schema';

@Injectable()
export class PgUserRepository implements UserRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  async findByEmail(email: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return new User(row.id, row.email, row.role, row.organization, row.team);
  }

  async save(user: User): Promise<void> {
    await this.db
      .insert(users)
      .values({
        id: user.id,
        email: user.email,
        role: user.role,
        organization: user.organization,
        team: user.team,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: user.email,
          role: user.role,
          organization: user.organization,
          team: user.team,
        },
      });
  }
}
```

**Design points:**
- Maps between domain entity (pure TS class) and Drizzle row in the repository
- Domain entity construction happens here (infrastructure layer) -- correct placement
- `DRIZZLE` token injected via NestJS DI, not the pool directly
- No Drizzle types leak into domain or application layers

### 5. Per-Service Drizzle Kit Configuration

```typescript
// apps/auth/drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infrastructure/persistence/schema/index.ts',
  out: './src/infrastructure/persistence/migrations',
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

**Why per-service `drizzle.config.ts`:**
- Each service owns its schema and migrations independently
- `schemaFilter` ensures drizzle-kit only touches that service's PostgreSQL schema
- Migration tracking table lives in the service's own schema (no collision between services)
- Monorepo script: `pnpm --filter auth exec drizzle-kit generate`

### 6. Module Wiring Change (Example: auth)

```typescript
// apps/auth/src/auth.module.ts -- AFTER migration
import { DrizzleModule } from '@email-platform/foundation';
import { PgUserRepository } from './infrastructure/persistence/user.repository';

@Module({
  imports: [
    AppConfigModule,
    DrizzleModule.forRoot(),           // NEW: provides DRIZZLE token
    LoggingModule.forGrpcAsync('auth'),
    HealthModule,
  ],
  controllers: [AuthGrpcServer],
  providers: [
    { provide: USER_REPOSITORY_PORT, useClass: PgUserRepository },  // CHANGED: Mongo -> Pg
    { provide: LOGIN_PORT, useClass: LoginUseCase },
  ],
})
export class AuthModule implements OnModuleDestroy { ... }
```

## Modified Components

### Config Package Changes

`packages/config/src/infrastructure.ts`:
```
BEFORE: MONGODB_URI: z.string().min(1)
AFTER:  DATABASE_URL: z.string().min(1)
```

Format: `postgresql://user:password@host:5432/email_platform`

### Health Constants Changes

`packages/foundation/src/health/health-constants.ts`:
```
BEFORE: INDICATOR: { MONGODB: 'mongodb', ... }
AFTER:  INDICATOR: { POSTGRESQL: 'postgresql', ... }
```

### Foundation Index Exports

`packages/foundation/src/index.ts`:
```
REMOVE: export * from './health/indicators/mongodb.health';
ADD:    export * from './health/indicators/postgresql.health';
ADD:    export * from './database/drizzle.module';
ADD:    export * from './database/drizzle.constants';
```

### Docker Compose

Replace `mongodb` service block with `postgresql`:

```yaml
postgresql:
  image: postgres:16-alpine
  environment:
    POSTGRES_DB: email_platform
    POSTGRES_USER: ${POSTGRES_USER:-emailplatform}
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-emailplatform}
  volumes:
    - postgres_data:/var/lib/postgresql/data
  restart: unless-stopped
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-emailplatform}"]
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 10s
  networks: [infra]
```

All service `depends_on` entries change from `mongodb` to `postgresql`.

## Removed Components

| Component | Reason |
|-----------|--------|
| `packages/foundation/src/health/indicators/mongodb.health.ts` | Replaced by `postgresql.health.ts` |
| `apps/auth/src/infrastructure/persistence/mongo-user.repository.ts` | Replaced by `user.repository.ts` (Pg) |
| `apps/sender/src/infrastructure/persistence/mongo-campaign.repository.ts` | Replaced by `campaign.repository.ts` (Pg) |
| `apps/parser/src/infrastructure/persistence/mongo-parser-task.repository.ts` | Replaced by `parser-task.repository.ts` (Pg) |
| `apps/audience/src/infrastructure/persistence/mongo-recipient.repository.ts` | Replaced by `recipient.repository.ts` (Pg) |

## Data Flow

```
HTTP Request
  -> Gateway (REST, no DB)
    -> gRPC call to Service
      -> gRPC Server (infrastructure/grpc/)
        -> Use Case (application/use-cases/)
          -> Repository Port (application/ports/outbound/) <-- INTERFACE (unchanged)
            -> Repository Adapter (infrastructure/persistence/) <-- DRIZZLE IMPL (new)
              -> Drizzle query builder
                -> pg Pool
                  -> PostgreSQL (schema: {service_name})
```

**What changes in the data flow:** Only the bottom 3 layers. Everything from repository port upward is untouched. This is exactly the benefit of hexagonal architecture -- swapping an adapter behind a port.

## Migration Strategy

### Development: `drizzle-kit push`
Fast iteration, pushes schema changes directly to database. No migration files generated.

### Production: Generated SQL migrations
```bash
# Generate migration SQL
pnpm --filter auth exec drizzle-kit generate

# Migrations applied at app startup
```

Migrations run at application startup using `drizzle-orm/node-postgres/migrator`:
```typescript
import { migrate } from 'drizzle-orm/node-postgres/migrator';
await migrate(db, { migrationsFolder: './src/infrastructure/persistence/migrations' });
```

**Where to run migrate:** In `main.ts` after creating the NestJS app but before starting microservices. This keeps migration execution in the composition root, not in the module.

### Schema Creation
PostgreSQL schemas (`auth`, `sender`, `parser`, `audience`) are created automatically by Drizzle migrations when the schema definition references `pgSchema('auth')`. The generated SQL includes `CREATE SCHEMA IF NOT EXISTS "auth"`.

## Anti-Patterns to Avoid

### 1. Domain entities importing Drizzle types
**What:** Using `InferSelectModel<typeof users>` in domain entities or application ports.
**Why bad:** Couples domain to ORM. Breaks hexagonal architecture dependency rule.
**Instead:** Map between Drizzle rows and domain entities in the repository adapter.

### 2. Shared schema package across services
**What:** Putting all Drizzle schemas in `packages/contracts/` or a new `packages/database/`.
**Why bad:** Services must own their data. Shared schemas create coupling and migration conflicts.
**Instead:** Each service defines schemas in its own `infrastructure/persistence/schema/`.

### 3. Cross-service foreign keys
**What:** Defining FK from `sender.campaigns.audience_group_id` referencing `audience.groups.id`.
**Why bad:** Cross-service data ownership violation. Services communicate via gRPC, not shared tables.
**Instead:** Store IDs as plain text/uuid. Referential integrity enforced at application layer via gRPC calls.

### 4. Centralized migration runner
**What:** Running all service migrations from the foundation package or a single script.
**Why bad:** Migration ordering becomes coupled. One service's migration failure blocks all others.
**Instead:** Each service runs its own migrations at startup for its own schema only.

### 5. Using Drizzle relational query API across schemas
**What:** Defining `relations()` between tables in different PostgreSQL schemas.
**Why bad:** Even though PostgreSQL allows cross-schema joins, it violates service boundaries.
**Instead:** Keep relations within a single service's schema only.

## Transactions (Future Consideration)

The project already uses `nestjs-cls` (v6.2.0) for correlation IDs. When business logic requires transactions, the `@nestjs-cls/transactional` plugin with Drizzle adapter provides request-scoped transaction management without passing `tx` through every method call. This is not needed now (no business logic yet) but the foundation is already in place via CLS.

## Build Order (Dependency-Aware)

The build order respects the dependency chain: `config -> foundation -> apps`.

1. **Config package** -- Replace `MONGODB_URI` with `DATABASE_URL` in env schema
2. **Foundation package** -- Create `DrizzleModule`, `PostgresHealthIndicator`; remove MongoDB health indicator; update barrel exports
3. **Docker infrastructure** -- Replace MongoDB with PostgreSQL in `docker-compose.yml`; update `.env.docker`
4. **Auth service** (reference implementation) -- Create schema, repository, module wiring, drizzle.config.ts, migrations
5. **Remaining services** (sender, parser, audience) -- Replicate auth pattern
6. **Verification** -- Full stack startup, all health checks green

**Why auth first:** It is the established reference Clean/Hexagonal implementation in this codebase. Establish and validate the persistence pattern there, then replicate mechanically to other services.

**Why notifier and gateway are excluded:** Neither has a repository port or persistence need. They are unaffected by this migration.

## Scalability Path

| Concern | At MVP (single PG) | At 10K users | At 100K+ users |
|---------|---------------------|--------------|-----------------|
| Connection pool | Single shared pool, default size | Pool size tuning per service | PgBouncer external pooler |
| Schema isolation | PostgreSQL schemas | Same | Separate databases per service |
| Migrations | Run at app startup | Same | Separate migration job in CI |
| Read performance | Single instance | Read replicas | Read replica pool in DrizzleModule |

## Sources

- [Drizzle ORM - pgSchema documentation](https://orm.drizzle.team/docs/schemas) -- HIGH confidence
- [Drizzle ORM - PostgreSQL setup guide](https://orm.drizzle.team/docs/get-started/postgresql-new) -- HIGH confidence
- [Drizzle ORM - Config reference](https://orm.drizzle.team/docs/drizzle-config-file) -- HIGH confidence
- [Drizzle ORM - Migrations](https://orm.drizzle.team/docs/migrations) -- HIGH confidence
- [Trilon: NestJS and DrizzleORM integration](https://trilon.io/blog/nestjs-drizzleorm-a-great-match) -- MEDIUM confidence
- [nestjs-cls Drizzle transactional adapter](https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional/drizzle-orm-adapter) -- MEDIUM confidence (future use)
- [Wanago: NestJS #149 Drizzle ORM with PostgreSQL](http://wanago.io/2024/05/20/api-nestjs-drizzle-orm-postgresql/) -- MEDIUM confidence
- [GitHub: drizzle-orm/issues/1365 - Multiple schemas](https://github.com/drizzle-team/drizzle-orm/issues/1365) -- MEDIUM confidence (known limitation awareness)

---

*Architecture research: 2026-04-04*
