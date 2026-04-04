# Phase 10: Foundation DrizzleModule & Health - Research

**Researched:** 2026-04-04
**Domain:** NestJS dynamic module for Drizzle ORM + node-postgres, health indicator abstraction, pool lifecycle
**Confidence:** HIGH

## Summary

Phase 10 creates three modules in `packages/foundation`: `DrizzleModule` (Pool + Drizzle instance via DI), `PostgresHealthModule` (health indicator behind abstraction), and `PersistenceModule` (facade re-exporting both). The Drizzle ORM API for node-postgres uses `drizzle({ client: pool })` from `drizzle-orm/node-postgres`, returning a `NodePgDatabase` type. The Pool is a separate DI provider enabling independent injection for health checks and graceful shutdown via `OnApplicationShutdown`.

All patterns needed already exist in the codebase: `LoggingModule` for dynamic module with `ConfigService` DI, `RedisHealthIndicator` for `HealthIndicatorService` usage, and `enableShutdownHooks()` in all 6 service `main.ts` files. This is a straightforward composition of established patterns with new dependencies.

**Primary recommendation:** Follow existing `LoggingModule` pattern exactly. Three files for modules, one for constants/tokens, one for the health indicator, one for the interface. Wire via `PersistenceModule.forRootAsync()` facade.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Three modules with facade pattern: DrizzleModule, PostgresHealthModule, PersistenceModule. Services import only PersistenceModule.
- **D-02:** Services import `PersistenceModule.forRootAsync()` -- never DrizzleModule or PostgresHealthModule directly.
- **D-03:** `DrizzleModule.forRootAsync()` using `ConfigService` DI + `useFactory`. Connection URL from `config.get('DATABASE_URL')`.
- **D-04:** DI tokens: `DRIZZLE` (Drizzle query instance), `PG_POOL` (node-postgres Pool).
- **D-05:** `DrizzleShutdownService` implements `OnApplicationShutdown` -- calls `pool.end()` on SIGTERM.
- **D-06:** `DatabaseHealthIndicator` interface with `isHealthy(key: string): Promise<HealthIndicatorResult>`. DI token: `DATABASE_HEALTH` (Symbol).
- **D-07:** `PostgresHealthIndicator` implements `DatabaseHealthIndicator`. Uses `PG_POOL` to run `SELECT 1`.
- **D-08:** Health controllers inject `@Inject(DATABASE_HEALTH)` -- never reference PostgreSQL directly.
- **D-09:** Phase 10 creates modules; services do NOT import PersistenceModule yet (Phase 12-13).
- **D-10:** Gateway and Notifier never import PersistenceModule.
- **D-11:** Install `drizzle-orm`, `pg`, `@types/pg` in packages/foundation. No `drizzle-kit`.

### Claude's Discretion
- Pool configuration defaults (max connections, idle timeout)
- Exact file placement within foundation/src/ directory structure
- Whether to use `persistence/` or `drizzle/` subdirectory in foundation

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | DrizzleModule in packages/foundation -- NestJS dynamic module with DI injection token | Drizzle API verified: `drizzle({ client: pool })` from `drizzle-orm/node-postgres`. `NodePgDatabase` type for annotation. LoggingModule pattern for DynamicModule structure. |
| FOUND-02 | DatabaseHealthIndicator abstraction via DI token -- concrete PostgresHealthIndicator registered in module, controller unaware of DB type | `HealthIndicatorService` pattern from existing RedisHealthIndicator. `SELECT 1` via `sql` tagged template from `drizzle-orm`. Interface + Symbol token for DI abstraction. |
| FOUND-03 | Pool lifecycle -- graceful shutdown via OnApplicationShutdown | `OnApplicationShutdown.onApplicationShutdown(signal?: string)` interface. `pool.end()` returns Promise. All services already call `app.enableShutdownHooks()`. |
</phase_requirements>

## Standard Stack

### Core (installed in packages/foundation)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `drizzle-orm` | 0.45.2 | Type-safe SQL ORM, query builder | Verified via `npm view` 2026-04-04. Provides `drizzle()` factory and `NodePgDatabase` type. |
| `pg` | 8.20.0 | PostgreSQL connection pool driver | `Pool` class integrates naturally with NestJS DI. Explicit `pool.end()` for shutdown. |
| `@types/pg` | 8.20.0 | TypeScript definitions for pg | Required for strict TS config. devDependency. |

### Supporting (already in project)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@nestjs/terminus` | ^11.1.1 | Health check infrastructure | Already a peerDependency. Provides `HealthIndicatorService`. |
| `@nestjs/config` | ^4.0.3 | ConfigService for DI | Already a peerDependency. Provides `DATABASE_URL` via DI. |

**Installation:**
```bash
pnpm --filter @email-platform/foundation add drizzle-orm pg
pnpm --filter @email-platform/foundation add -D @types/pg
```

## Architecture Patterns

### Recommended File Structure
```
packages/foundation/src/
  persistence/
    drizzle.module.ts            # DrizzleModule with forRootAsync()
    postgres-health.module.ts    # PostgresHealthModule
    persistence.module.ts        # PersistenceModule facade
    persistence.constants.ts     # DRIZZLE, PG_POOL, DATABASE_HEALTH tokens
    persistence.interfaces.ts    # DatabaseHealthIndicator interface
    drizzle-shutdown.service.ts  # DrizzleShutdownService (OnApplicationShutdown)
    postgres.health.ts           # PostgresHealthIndicator implementation
```

**Rationale:** Use `persistence/` subdirectory (not `drizzle/` or `database/`). The facade is `PersistenceModule` which is DB-agnostic in name. Grouping all persistence concerns in one directory keeps the abstraction layer clean. Follows the same pattern as `logging/` and `health/` subdirectories.

### Pattern 1: DI Tokens as Symbols

```typescript
// packages/foundation/src/persistence/persistence.constants.ts
export const DRIZZLE = Symbol('DRIZZLE');
export const PG_POOL = Symbol('PG_POOL');
export const DATABASE_HEALTH = Symbol('DATABASE_HEALTH');
```

**Why Symbols:** Prevents token collision. Consistent with NestJS DI best practices. The three tokens serve different consumers: `DRIZZLE` for repository adapters, `PG_POOL` for health indicator and shutdown, `DATABASE_HEALTH` for health controllers.

### Pattern 2: DrizzleModule with useFactory

```typescript
// packages/foundation/src/persistence/drizzle.module.ts
import { Module, type DynamicModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE, PG_POOL } from './persistence.constants';
import { DrizzleShutdownService } from './drizzle-shutdown.service';

@Module({})
export class DrizzleModule {
  static forRootAsync(): DynamicModule {
    return {
      module: DrizzleModule,
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
          useFactory: (pool: Pool): NodePgDatabase =>
            drizzle({ client: pool }),
        },
        DrizzleShutdownService,
      ],
      exports: [DRIZZLE, PG_POOL],
    };
  }
}
```

**Key design decisions:**
- `forRootAsync()` name (not `forRoot()`) -- signals async ConfigService dependency, consistent with `LoggingModule.forGrpcAsync()` pattern.
- NOT marked `global: true` -- consumers import `PersistenceModule`, which controls scope.
- Pool is separate provider from Drizzle instance -- enables independent injection for health checks.
- `DrizzleShutdownService` is registered as a plain provider (not exported) -- it only needs to exist in the DI container to receive shutdown hooks.

### Pattern 3: Health Indicator with DI Abstraction

```typescript
// packages/foundation/src/persistence/persistence.interfaces.ts
import type { HealthIndicatorResult } from '@nestjs/terminus';

export interface DatabaseHealthIndicator {
  isHealthy(key: string): Promise<HealthIndicatorResult>;
}
```

```typescript
// packages/foundation/src/persistence/postgres.health.ts
import { Inject, Injectable } from '@nestjs/common';
import { type HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import { Pool } from 'pg';
import { PG_POOL } from './persistence.constants';

@Injectable()
export class PostgresHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      await this.pool.query('SELECT 1');
      return indicator.up();
    } catch {
      return indicator.down({ message: 'PostgreSQL connection failed' });
    }
  }
}
```

**Why inject PG_POOL (not DRIZZLE) for health checks:** The health probe runs `SELECT 1` -- a raw driver operation. Using `pool.query()` instead of `db.execute(sql\`SELECT 1\`)` avoids importing `sql` from drizzle-orm in the health indicator and keeps it purely a driver-level check. This is also more reliable -- if Drizzle has an issue, the health check still tests actual connectivity.

### Pattern 4: Graceful Shutdown Service

```typescript
// packages/foundation/src/persistence/drizzle-shutdown.service.ts
import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from './persistence.constants';

@Injectable()
export class DrizzleShutdownService implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(signal?: string): Promise<void> {
    await this.pool.end();
  }
}
```

**Key points:**
- `OnApplicationShutdown` is the correct interface (not `OnModuleDestroy`). It fires after all connections are drained.
- All 6 services already call `app.enableShutdownHooks()` in their `main.ts` -- no changes needed there.
- `pool.end()` returns a Promise that resolves when all clients have disconnected. NestJS awaits it.
- The `signal` parameter is optional (`string | undefined`).

### Pattern 5: PersistenceModule Facade

```typescript
// packages/foundation/src/persistence/persistence.module.ts
import { Module, type DynamicModule } from '@nestjs/common';
import { DrizzleModule } from './drizzle.module';
import { PostgresHealthModule } from './postgres-health.module';
import { DRIZZLE, PG_POOL, DATABASE_HEALTH } from './persistence.constants';

@Module({})
export class PersistenceModule {
  static forRootAsync(): DynamicModule {
    return {
      module: PersistenceModule,
      imports: [DrizzleModule.forRootAsync(), PostgresHealthModule],
      exports: [DrizzleModule, PostgresHealthModule],
    };
  }
}
```

**Why facade:** Services write `PersistenceModule.forRootAsync()` -- one import, gets DRIZZLE token, PG_POOL token, and DATABASE_HEALTH token. Swapping PostgreSQL for another DB means changing the internals of PersistenceModule, not every service module.

### Pattern 6: PostgresHealthModule

```typescript
// packages/foundation/src/persistence/postgres-health.module.ts
import { Module } from '@nestjs/common';
import { PostgresHealthIndicator } from './postgres.health';
import { DATABASE_HEALTH } from './persistence.constants';

@Module({
  providers: [
    PostgresHealthIndicator,
    { provide: DATABASE_HEALTH, useExisting: PostgresHealthIndicator },
  ],
  exports: [DATABASE_HEALTH],
})
export class PostgresHealthModule {}
```

**Why `useExisting`:** `PostgresHealthIndicator` is the concrete class. `DATABASE_HEALTH` is the abstraction token. `useExisting` means NestJS creates one instance and serves it via both tokens. Health controllers inject `DATABASE_HEALTH` and never know it is PostgreSQL.

### Anti-Patterns to Avoid

- **Top-level Drizzle initialization:** Never `const db = drizzle(...)` at module scope. Always inside `useFactory`.
- **Global module:** DrizzleModule should NOT be `global: true`. Only the service modules that need it import PersistenceModule.
- **Injecting DRIZZLE in health checks:** Health indicator injects PG_POOL, not DRIZZLE. Driver-level check is more reliable.
- **Direct pool.query in repositories:** Repositories use DRIZZLE token (Drizzle query builder), never PG_POOL directly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pool creation | Custom connection manager | `new Pool()` from `pg` | Pool handles connection recycling, idle timeout, max connections |
| Health check protocol | Custom HTTP/gRPC health probes | `HealthIndicatorService` from `@nestjs/terminus` | Standard `.check(key).up()/.down()` API, integrates with Terminus |
| DI abstraction | Custom service locator | NestJS Symbol tokens + `useExisting` | Framework-native, type-safe, testable |
| Shutdown orchestration | Custom signal handlers | `OnApplicationShutdown` interface | NestJS manages ordering and awaits promises |

## Common Pitfalls

### Pitfall 1: Pool Connects Before Config Is Ready
**What goes wrong:** Pool created at module import time, before `ConfigService` is available. `DATABASE_URL` is `undefined`.
**Why it happens:** Drizzle docs show top-level initialization. Developers copy-paste.
**How to avoid:** Pool creation MUST be inside `useFactory` with `inject: [ConfigService]`.
**Warning signs:** `ECONNREFUSED` or `undefined` URL errors at bootstrap.

### Pitfall 2: Forgetting to Export PG_POOL from DrizzleModule
**What goes wrong:** `PostgresHealthModule` imports `DrizzleModule` but cannot inject `PG_POOL` because it is not exported.
**Why it happens:** Only `DRIZZLE` seems like the "public" API. `PG_POOL` is seen as internal.
**How to avoid:** DrizzleModule MUST export both `DRIZZLE` and `PG_POOL`. The health module and shutdown service need the pool.
**Warning signs:** NestJS DI error: `Nest can't resolve dependencies of PostgresHealthIndicator`.

### Pitfall 3: Using OnModuleDestroy Instead of OnApplicationShutdown
**What goes wrong:** Pool is closed too early during shutdown, while other modules still have in-flight queries.
**Why it happens:** `OnModuleDestroy` and `OnApplicationShutdown` sound similar.
**How to avoid:** Use `OnApplicationShutdown` -- it fires AFTER all modules are destroyed and connections drained.
**Warning signs:** Connection errors during graceful shutdown.

### Pitfall 4: Health Indicator Not in TerminusModule Scope
**What goes wrong:** `HealthIndicatorService` cannot be injected because `TerminusModule` is not imported in the module providing the health indicator.
**Why it happens:** `HealthIndicatorService` is provided by `TerminusModule`. If the health indicator lives in a module that doesn't import Terminus, DI fails.
**How to avoid:** `PostgresHealthModule` must import `TerminusModule`, OR the service-level `HealthModule` (which already imports `TerminusModule`) provides the indicator. Since existing RedisHealthIndicator/RabbitMqHealthIndicator are standalone `@Injectable()` classes used directly in service health modules, the `PostgresHealthIndicator` follows the same pattern -- it needs `TerminusModule` in scope where it is provided.
**Warning signs:** `Nest can't resolve dependencies of PostgresHealthIndicator (?, PG_POOL)` -- the `?` is `HealthIndicatorService`.

### Pitfall 5: NodePgDatabase Type Mismatch with Schema
**What goes wrong:** `NodePgDatabase` without a schema type parameter doesn't support Drizzle's relational query API.
**Why it happens:** `NodePgDatabase` is generic: `NodePgDatabase<TSchema>`. Without passing schema, relational queries are unavailable.
**How to avoid:** For Phase 10, `NodePgDatabase` without schema generic is correct -- no schemas exist yet. In Phase 12-13, repositories will cast or use `db.select().from(table)` which works without schema generic. Relational API is unnecessary.
**Warning signs:** TypeScript errors when using `db.query.*` API (but we use `db.select().from()` instead).

## Code Examples

### Complete DrizzleModule (verified pattern)

```typescript
// Source: Drizzle docs + NestJS DynamicModule pattern
import { Module, type DynamicModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE, PG_POOL } from './persistence.constants';
import { DrizzleShutdownService } from './drizzle-shutdown.service';

@Module({})
export class DrizzleModule {
  static forRootAsync(): DynamicModule {
    return {
      module: DrizzleModule,
      providers: [
        {
          provide: PG_POOL,
          inject: [ConfigService],
          useFactory: (config: ConfigService): Pool =>
            new Pool({
              connectionString: config.get<string>('DATABASE_URL'),
              max: 10,
              idleTimeoutMillis: 30_000,
              connectionTimeoutMillis: 5_000,
            }),
        },
        {
          provide: DRIZZLE,
          inject: [PG_POOL],
          useFactory: (pool: Pool): NodePgDatabase =>
            drizzle({ client: pool }),
        },
        DrizzleShutdownService,
      ],
      exports: [DRIZZLE, PG_POOL],
    };
  }
}
```

**Pool defaults rationale:**
- `max: 10` -- reasonable default for microservices. Each service has its own pool.
- `idleTimeoutMillis: 30_000` -- close idle clients after 30s to free connections.
- `connectionTimeoutMillis: 5_000` -- fail fast if PostgreSQL is unreachable.

### Barrel Export Update

```typescript
// packages/foundation/src/index.ts -- additions
export * from './persistence/persistence.module';
export * from './persistence/persistence.constants';
export * from './persistence/persistence.interfaces';
```

**Not exported:** `DrizzleModule`, `PostgresHealthModule`, `DrizzleShutdownService`, `PostgresHealthIndicator` -- these are internal to the facade. Services only see `PersistenceModule`, tokens, and the interface.

### Health Constants Update

```typescript
// packages/foundation/src/health/health-constants.ts -- add POSTGRESQL
export const HEALTH = {
  // ... existing fields unchanged ...
  INDICATOR: {
    MEMORY_HEAP: 'memory_heap',
    REDIS: 'redis',
    RABBITMQ: 'rabbitmq',
    POSTGRESQL: 'postgresql',  // NEW
  },
} as const;
```

### Future Consumer Pattern (Phase 12-13 reference)

```typescript
// How services will import in Phase 12-13 (NOT Phase 10)
import { PersistenceModule, DATABASE_HEALTH } from '@email-platform/foundation';

@Module({
  imports: [
    AppConfigModule,
    PersistenceModule.forRootAsync(),
    LoggingModule.forGrpcAsync('auth'),
    HealthModule,
  ],
  // ...
})
export class AuthModule {}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `drizzle(pool)` (positional arg) | `drizzle({ client: pool })` (options object) | Drizzle 0.30+ | Old API deprecated but still works. Use options object. |
| `NodePgDatabase` without generic | `NodePgDatabase<TSchema>` for relational queries | Drizzle 0.28+ | Without schema generic, relational API unavailable. Fine for `select().from()` pattern. |
| `HealthIndicator` base class | `HealthIndicatorService` injected service | @nestjs/terminus 10+ | Base class deprecated. Current codebase already uses `HealthIndicatorService`. |

## Open Questions

1. **TerminusModule import in PostgresHealthModule**
   - What we know: `HealthIndicatorService` requires `TerminusModule` in scope. Existing health indicators (Redis, RabbitMQ) are standalone `@Injectable()` classes without their own module.
   - What's unclear: Whether `PostgresHealthModule` needs to import `TerminusModule` itself, or whether it is resolved from the parent scope when the service's `HealthModule` imports both.
   - Recommendation: Import `TerminusModule` in `PostgresHealthModule` to be self-contained. NestJS deduplicates module instances, so no overhead from importing it twice.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None configured (project constraint: no tests in this phase) |
| Config file | N/A |
| Quick run command | `pnpm --filter @email-platform/foundation build` (TypeScript compilation) |
| Full suite command | `pnpm build` (all packages + apps) |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUND-01 | DrizzleModule provides DRIZZLE and PG_POOL tokens | build | `pnpm --filter @email-platform/foundation build` | N/A (no tests) |
| FOUND-02 | DATABASE_HEALTH token with PostgresHealthIndicator | build | `pnpm --filter @email-platform/foundation build` | N/A (no tests) |
| FOUND-03 | Pool shutdown on OnApplicationShutdown | build + manual | `pnpm build` then start services | N/A (no tests) |

### Sampling Rate
- **Per task commit:** `pnpm --filter @email-platform/foundation build`
- **Per wave merge:** `pnpm build` (full monorepo)
- **Phase gate:** All 6 services start without errors

### Wave 0 Gaps
None -- project constraint explicitly excludes tests. Validation is via TypeScript compilation and service startup.

## Project Constraints (from CLAUDE.md)

- **No tests:** Testing is a separate next phase. No test files to create.
- **No business logic:** Only structural scaffolding.
- **Tech stack locked:** NestJS 11, TypeScript, gRPC -- no changes.
- **No switch/case or if/else chains:** Use dispatch patterns. (Not applicable in this phase -- no branching logic.)
- **No environment branching:** Config via `ConfigService`, not `process.env` directly.
- **12-Factor:** `DATABASE_URL` from config module, not hardcoded.
- **packages/ architecture:** Simple utility structure, no DDD. (Foundation is a utility package.)
- **Barrel exports:** `index.ts` re-exports public API only. Internal modules stay private.

## Sources

### Primary (HIGH confidence)
- [Drizzle ORM - PostgreSQL Getting Started](https://orm.drizzle.team/docs/get-started/postgresql-new) -- `drizzle({ client: pool })` API verified
- [Drizzle ORM - Database connection overview](https://orm.drizzle.team/docs/connect-overview) -- Connection patterns, `$client` accessor
- [Drizzle ORM - node-postgres installation](https://orm.drizzle.team/docs/installation-and-db-connection/postgresql/node-postgres) -- Import paths verified
- [NestJS Lifecycle Events](https://docs.nestjs.com/fundamentals/lifecycle-events) -- `OnApplicationShutdown` interface signature
- npm registry (`npm view` 2026-04-04) -- drizzle-orm 0.45.2, pg 8.20.0, @types/pg 8.20.0

### Secondary (MEDIUM confidence)
- [Drizzle ORM GitHub Discussion #228](https://github.com/drizzle-team/drizzle-orm/discussions/228) -- Pool lifecycle and `pool.end()` pattern
- [Trilon: NestJS and DrizzleORM](https://trilon.io/blog/nestjs-drizzleorm-a-great-match) -- NestJS integration pattern reference

### Codebase (HIGH confidence)
- `packages/foundation/src/logging/logging.module.ts` -- DynamicModule pattern with ConfigService DI
- `packages/foundation/src/health/indicators/redis.health.ts` -- HealthIndicatorService usage pattern
- `packages/foundation/src/health/health-constants.ts` -- HEALTH constants structure
- `packages/foundation/src/index.ts` -- Barrel export pattern
- `packages/foundation/package.json` -- Current dependencies and peer dependencies

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- versions verified via npm registry, API verified via official docs
- Architecture: HIGH -- patterns directly replicate existing codebase patterns (LoggingModule, RedisHealthIndicator)
- Pitfalls: HIGH -- verified against Drizzle docs and NestJS lifecycle documentation

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable libraries, unlikely to change)
