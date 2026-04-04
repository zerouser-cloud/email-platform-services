# Technology Stack: PostgreSQL + Drizzle Migration

**Project:** Email Platform v2.0 -- PostgreSQL + Drizzle Migration
**Researched:** 2026-04-04
**Focus:** Replace MongoDB with PostgreSQL + Drizzle ORM in existing NestJS microservices monorepo

## Recommended Stack Additions

### Database

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| PostgreSQL | 16 (Docker image: `postgres:16-alpine`) | Primary relational database | Relational model fits domain (campaigns -> groups -> recipients), ACID transactions, mature ecosystem. v16 for logical replication improvements and performance. Alpine for smaller image. |

### ORM and Driver

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `drizzle-orm` | 0.45.2 | Type-safe SQL ORM | SQL-like API (no magic), zero runtime overhead, schema-as-code in TypeScript, perfect fit with strict TS config. Not Prisma because: no code generation step, no engine binary, lighter footprint in Docker, better monorepo story. |
| `drizzle-kit` | 0.31.10 | Migration CLI (generate, migrate, push) | Companion tool for drizzle-orm. Generates SQL migration files from schema diff, applies them. Needed as devDependency only. |
| `pg` | 8.20.0 | PostgreSQL driver (node-postgres) | Most mature and widely-used PostgreSQL driver for Node.js. Explicit `Pool` class integrates cleanly with NestJS lifecycle (inject pool, call `pool.end()` on destroy). First-class `drizzle-orm/node-postgres` adapter. |
| `@types/pg` | 8.20.0 | TypeScript type definitions for pg | Required for strict TypeScript configuration. |

### Why node-postgres (pg) over postgres.js

| Criterion | node-postgres (pg) | postgres.js |
|-----------|-------------------|-------------|
| Maturity | 10+ years, dominant in Node.js ecosystem | Newer, smaller community |
| NestJS integration | `Pool` class maps naturally to NestJS providers and DI | Custom connection management needed |
| Graceful shutdown | `pool.end()` is explicit and reliable | `sql.end()` works but less conventional in NestJS |
| Connection pooling | Separate `Pool` class, injectable as NestJS provider | Built-in but opaque, harder to expose for health checks |
| TypeScript | Needs `@types/pg` (well-maintained, version-synced) | Native TS but tagged template API is unusual |
| Docker | Pure JS (pg-native is optional, not needed) | Pure JS |
| Performance | Slightly slower than postgres.js in benchmarks | Fastest pure-JS driver |
| Drizzle support | First-class via `drizzle-orm/node-postgres` | First-class via `drizzle-orm/postgres-js` |
| Community examples | Vast majority of NestJS + Drizzle examples use pg | Fewer NestJS examples |

**Decision:** Use `pg` (node-postgres) because its `Pool` class integrates naturally with NestJS dependency injection and lifecycle hooks. The explicit pool management enables clean health checks (inject pool, run `SELECT 1`) and graceful shutdown (`pool.end()` in `onModuleDestroy`). Performance difference is negligible for this workload. The existing ARCHITECTURE.md research established this pattern with `drizzle-orm/node-postgres`.

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `drizzle-orm` | 0.45.2 | Schema definition, query builder, migrations runtime | Every service that accesses PostgreSQL |
| `drizzle-kit` | 0.31.10 | CLI for migration generation and application | Dev only. Run from shared package or root scripts. |
| `pg` | 8.20.0 | PostgreSQL connection pool and driver | Injected into Drizzle initialization |
| `@types/pg` | 8.20.0 | TypeScript definitions for pg | Dev dependency |

### What NOT to Add

| Library | Why Not |
|---------|---------|
| `prisma` / `@prisma/client` | Code generation step, engine binary bloats Docker, worse monorepo DX, overkill for this architecture |
| `typeorm` | Heavy, decorator-based schema (conflicts with domain-first approach), poor migration story, declining community momentum |
| `postgres` (postgres.js) | postgres.js Pool is less NestJS-friendly than pg Pool for DI and lifecycle hooks. Considered but pg is better fit for this architecture. |
| `@knaadh/nestjs-drizzle-pg` | Thin wrapper (v1.2.0) that adds unnecessary abstraction. Manual Drizzle provider in ~15 lines is cleaner, more controllable, and avoids third-party dependency risk. |
| `mikro-orm` | Good ORM but adds Unit of Work complexity unnecessary for this project's hexagonal architecture where repositories are explicit |
| `knex` | Query builder without ORM features. Drizzle already covers query building with better type safety. |
| `@nestjs/typeorm` / `@nestjs/sequelize` | NestJS ORM integrations for ORMs we are not using |
| `pg-native` | Optional native binding for pg that requires build tools in Docker. Not worth the ~10% speedup vs. added Docker complexity. |

## Integration Points with Existing Monorepo

### Where Drizzle Code Lives

```
packages/
  foundation/
    src/
      database/
        drizzle.module.ts      # NestJS DynamicModule: DrizzleModule.forRoot()
        drizzle.constants.ts   # Injection token: DRIZZLE (Symbol)
      health/
        indicators/
          postgresql.health.ts # Replaces mongodb.health.ts

apps/
  auth/
    src/
      infrastructure/
        persistence/
          schema/              # Drizzle schema files (pgSchema + pgTable definitions)
          migrations/          # Generated SQL migration files
          repositories/        # Repository implementations using Drizzle
    drizzle.config.ts          # Per-service drizzle-kit config (at service root)
```

**Rationale:** Schema and migrations are per-service (data ownership). Drizzle provider is shared (foundation package). This preserves hexagonal architecture -- domain layer never imports drizzle-orm.

### Environment Changes

Current `InfrastructureSchema` (in `packages/config/src/infrastructure.ts`):

```typescript
// REMOVE
MONGODB_URI: z.string().min(1),

// ADD
DATABASE_URL: z.string().min(1),
```

`DATABASE_URL` format: `postgresql://user:password@host:5432/email_platform`

Single database, per-service PostgreSQL schemas (`auth`, `sender`, `parser`, `audience`) for logical isolation.

### Docker Compose Changes

Replace `mongodb` service with `postgresql`:

```yaml
# REMOVE
mongodb:
  image: mongo:7
  volumes:
    - mongo_data:/data/db
  healthcheck:
    test: ["CMD", "mongosh", "--eval", "db.runCommand('ping').ok"]

# ADD
postgresql:
  image: postgres:16-alpine
  environment:
    POSTGRES_DB: ${POSTGRES_DB:-email_platform}
    POSTGRES_USER: ${POSTGRES_USER:-emailplatform}
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-emailplatform}
  volumes:
    - postgres_data:/var/lib/postgresql/data
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-emailplatform}"]
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 10s
  networks: [infra]
```

Service `depends_on` entries change from `mongodb` to `postgresql`.
Volume `mongo_data` removed, `postgres_data` added.

### Health Indicator Replacement

Replace `MongoHealthIndicator` with `PostgresHealthIndicator`. The health indicator injects the Drizzle instance and executes `SELECT 1` to verify connectivity. Update `HEALTH.INDICATOR.MONGODB` to `HEALTH.INDICATOR.POSTGRESQL` in health-constants.ts.

### NestJS Provider Pattern

No third-party NestJS module needed. Create a dynamic module in foundation:

```typescript
// packages/foundation/src/database/drizzle.module.ts
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
          useFactory: (config: ConfigService): Pool =>
            new Pool({ connectionString: config.get<string>('DATABASE_URL') }),
        },
        {
          provide: DRIZZLE,
          inject: [PG_POOL],
          useFactory: (pool: Pool): NodePgDatabase => drizzle({ client: pool }),
        },
      ],
      exports: [DRIZZLE],
    };
  }
}
```

**Key design:** Pool is a separate provider so it can be injected independently for health checks and graceful shutdown (`pool.end()`).

### Migration Workflow

```bash
# Generate SQL from schema changes (per service)
pnpm --filter auth exec drizzle-kit generate

# Apply migrations (at startup or via script)
pnpm --filter auth exec drizzle-kit migrate

# Dev-only: push schema directly (skip SQL files)
pnpm --filter auth exec drizzle-kit push

# Dev-only: visual database browser
pnpm --filter auth exec drizzle-kit studio
```

**drizzle.config.ts** per service:

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infrastructure/persistence/schema/index.ts',
  out: './src/infrastructure/persistence/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  schemaFilter: ['auth'],           // Only manage this service's PG schema
  migrations: {
    table: '__drizzle_migrations',
    schema: 'auth',                  // Migration tracking in service's own schema
  },
});
```

## Installation

```bash
# Core dependencies (in packages/foundation)
pnpm --filter @email-platform/foundation add drizzle-orm pg

# Type definitions (in packages/foundation)
pnpm --filter @email-platform/foundation add -D @types/pg

# Migration CLI (root or each app)
pnpm add -D drizzle-kit

# Each app that uses drizzle needs drizzle-orm as dependency too
# (for schema definitions in infrastructure/persistence/schema/)
pnpm --filter auth add drizzle-orm
pnpm --filter sender add drizzle-orm
pnpm --filter parser add drizzle-orm
pnpm --filter audience add drizzle-orm
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| ORM | Drizzle ORM | Prisma | Code generation, engine binary, Docker bloat, worse monorepo story |
| ORM | Drizzle ORM | TypeORM | Decorator schemas conflict with domain-first, poor migration DX, declining ecosystem |
| ORM | Drizzle ORM | MikroORM | Better than TypeORM but Unit of Work adds complexity, less community adoption |
| Driver | node-postgres (pg) | postgres.js | pg Pool integrates better with NestJS DI and lifecycle, vast majority of NestJS examples use pg |
| Driver | node-postgres (pg) | pg + pg-native | pg-native requires native build tools in Docker, marginal speedup not worth complexity |
| NestJS Integration | Manual provider (~15 LOC) | @knaadh/nestjs-drizzle-pg | Unnecessary abstraction, small maintainer, version coupling risk |
| Database | PostgreSQL 16-alpine | PostgreSQL 17 | v17 is newer but v16 has longer LTS track record, alpine image well-tested |

## Version Confidence

| Package | Version | Confidence | Verified Via |
|---------|---------|------------|-------------|
| drizzle-orm | 0.45.2 | HIGH | npm registry (live `npm view` query, 2026-04-04) |
| drizzle-kit | 0.31.10 | HIGH | npm registry (live `npm view` query, 2026-04-04) |
| pg | 8.20.0 | HIGH | npm registry (live `npm view` query, 2026-04-04) |
| @types/pg | 8.20.0 | HIGH | npm registry (live `npm view` query, 2026-04-04) |
| PostgreSQL Docker | 16-alpine | HIGH | Standard Docker Hub image |

**Note on Drizzle v1.0:** A v1.0.0-beta is in active development. The stable 0.45.x line is production-ready and widely used. Upgrading to v1.0 when released should be straightforward (migration guide exists at orm.drizzle.team/docs/upgrade-v1). Do NOT use beta in production.

## Sources

- [Drizzle ORM - PostgreSQL Getting Started](https://orm.drizzle.team/docs/get-started-postgresql)
- [Drizzle Kit - Migrations Overview](https://orm.drizzle.team/docs/kit-overview)
- [Drizzle ORM npm](https://www.npmjs.com/package/drizzle-orm) -- version 0.45.2
- [drizzle-kit npm](https://www.npmjs.com/package/drizzle-kit) -- version 0.31.10
- [NestJS and DrizzleORM: A Great Match - Trilon](https://trilon.io/blog/nestjs-drizzleorm-a-great-match)
- [node-postgres documentation](https://node-postgres.com/)
- [node-postgres vs postgres.js benchmarks](https://dev.to/nigrosimone/benchmarking-postgresql-drivers-in-nodejs-node-postgres-vs-postgresjs-17kl)
- [NestJS Health Checks with Terminus](https://docs.nestjs.com/recipes/terminus)
- [Drizzle ORM v1 Upgrade Guide](https://orm.drizzle.team/docs/upgrade-v1)
- [Drizzle ORM - Latest Releases](https://orm.drizzle.team/docs/latest-releases)
