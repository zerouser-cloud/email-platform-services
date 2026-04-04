# Feature Landscape: PostgreSQL + Drizzle Migration

**Domain:** Database layer migration in NestJS microservices
**Researched:** 2026-04-04

## Table Stakes

Features that must exist for the migration to be complete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| PostgreSQL in Docker Compose | Services need a running database | Low | Replace mongo:7 with postgres:16-alpine, update volumes and healthcheck |
| DATABASE_URL env variable | Services need connection string | Low | Replace MONGODB_URI in env-schema.ts and .env files |
| DrizzleModule in foundation | Services need DI-provided database instance | Low | Dynamic module with forRoot(), ~30 lines total |
| PostgresHealthIndicator | Health checks must reflect actual database | Low | Replace MongoHealthIndicator, execute `SELECT 1` |
| Health constant update | INDICATOR.MONGODB -> INDICATOR.POSTGRESQL | Low | Single constant rename in health-constants.ts |
| Per-service Drizzle schema files | Each service needs table definitions | Medium | Schema files in infrastructure/persistence/schema/ |
| Migration generation workflow | Need reproducible schema changes | Low | drizzle-kit generate + drizzle.config.ts per service |
| Migration execution | Database must match schema | Low | drizzle-kit migrate in bootstrap or CI |
| Remove all MongoDB references | No dead code | Low | Delete mongodb.health.ts, remove from exports, update depends_on in docker-compose |

## Differentiators

Features that improve DX but are not strictly required for migration.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Drizzle Studio integration | Visual database browser for development | Low | `drizzle-kit studio` -- just needs drizzle.config.ts |
| Turbo pipeline for migrations | Run `pnpm migrate` from root | Low | Add migrate task to turbo.json |
| Connection pool monitoring | Observe pool exhaustion early | Medium | postgres.js exposes pool stats, integrate with health check |
| Graceful shutdown for DB | Clean connection teardown | Low | postgres.js `sql.end()` in NestJS onModuleDestroy |

## Anti-Features

Features to explicitly NOT build during this migration.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Shared schema package | Couples services, violates data ownership | Each service owns its schema in infrastructure layer |
| Auto-migration on boot | Dangerous in production, race conditions with multiple replicas | Run migrations explicitly in CI/CD or as a separate step |
| MongoDB-to-PostgreSQL data migration script | No actual data exists (only stubs) | Start fresh with PostgreSQL |
| Abstract database interface | Over-engineering when Drizzle is the only implementation | Use Drizzle directly in repository implementations |
| NestJS TypeORM or Prisma modules | Wrong ORM | Use Drizzle with manual provider |
| Database-per-service (initially) | Operational overhead for no benefit at current scale | Single database, schema-level isolation if needed |

## Feature Dependencies

```
PostgreSQL Docker service -> DATABASE_URL env var -> DrizzleModule provider -> PostgresHealthIndicator
PostgreSQL Docker service -> DATABASE_URL env var -> DrizzleModule provider -> Per-service schemas -> Migrations
MongoHealthIndicator removal -> PostgresHealthIndicator creation (swap)
```

## MVP Recommendation

Prioritize:
1. Docker Compose + env-schema changes (everything depends on this)
2. DrizzleModule in foundation (services need this to connect)
3. Health indicator swap (validates connection works)
4. At least one service schema as reference implementation (auth is the most complete)

Defer:
- Turbo pipeline for migrations (nice-to-have, manual commands work fine initially)
- Connection pool monitoring (optimize later when there is actual load)
- Drizzle Studio (developer convenience, not blocking)
