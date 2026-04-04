# Phase 10: Foundation DrizzleModule & Health - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Create shared persistence infrastructure in packages/foundation: DrizzleModule (DB connection + pool), PostgresHealthModule (health indicator via DI abstraction), and PersistenceModule (facade combining both). Services import only the facade. All 6 services must start successfully.

</domain>

<decisions>
## Implementation Decisions

### Module Architecture (3 layers)
- **D-01:** Three modules with facade pattern:
  - `DrizzleModule` — Pool creation, Drizzle instance, graceful shutdown. Exports `DRIZZLE` and `PG_POOL` tokens.
  - `PostgresHealthModule` — `PostgresHealthIndicator` implementing `DatabaseHealthIndicator` interface. Imports DrizzleModule for `PG_POOL`. Exports `DATABASE_HEALTH` token.
  - `PersistenceModule` — Facade that imports and re-exports both. **This is what services import.**
- **D-02:** Services import `PersistenceModule.forRootAsync()` — one line, gets everything. Never import DrizzleModule or PostgresHealthModule directly from services.

### DrizzleModule API
- **D-03:** `DrizzleModule.forRootAsync()` using `ConfigService` DI + `useFactory` pattern. Connection URL from `config.get('DATABASE_URL')`. Follows 12-Factor — module doesn't read env vars directly.
- **D-04:** DI tokens: `DRIZZLE` (Drizzle query instance), `PG_POOL` (node-postgres Pool for health checks and shutdown).
- **D-05:** `DrizzleShutdownService` implements `OnApplicationShutdown` — calls `pool.end()` on SIGTERM. Follows existing graceful shutdown pattern from Phase 7.

### Health Indicator Abstraction
- **D-06:** `DatabaseHealthIndicator` interface with `isHealthy(key: string): Promise<HealthIndicatorResult>`. DI token: `DATABASE_HEALTH` (Symbol).
- **D-07:** `PostgresHealthIndicator` implements `DatabaseHealthIndicator`. Uses `PG_POOL` to run `SELECT 1` as health probe. Registered as provider for `DATABASE_HEALTH` token inside PostgresHealthModule.
- **D-08:** Health controllers inject `@Inject(DATABASE_HEALTH)` — never reference PostgreSQL directly. Swapping DB = swap module inside PersistenceModule, zero controller changes.

### Import Scope
- **D-09:** Phase 10 creates the modules in foundation and exports them. Services do NOT import PersistenceModule yet — that happens in Phase 12-13 when schemas and repositories are added. Phase 10 just makes it available.
- **D-10:** Gateway and Notifier never import PersistenceModule — they don't use a database.

### Package Dependencies
- **D-11:** Install `drizzle-orm`, `pg`, `@types/pg` in packages/foundation. Do NOT install `drizzle-kit` here — that's per-service (Phase 12-13) for migration generation.

### Claude's Discretion
- Pool configuration defaults (max connections, idle timeout)
- Exact file placement within foundation/src/ directory structure
- Whether to use a dedicated `persistence/` subdirectory or `drizzle/` subdirectory in foundation

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing patterns to follow
- `packages/foundation/src/logging/logging.module.ts` — Dynamic module pattern with forHttp/forGrpc, ConfigService injection, APP_FILTER/APP_INTERCEPTOR registration
- `packages/foundation/src/index.ts` — Barrel export pattern for foundation package

### Health indicators (existing)
- `packages/foundation/src/health/indicators/redis.health.ts` — Existing health indicator pattern (HealthIndicatorService)
- `packages/foundation/src/health/indicators/rabbitmq.health.ts` — Same pattern
- `packages/foundation/src/health/health-constants.ts` — HEALTH constants

### Config
- `packages/config/src/infrastructure.ts` — DATABASE_URL definition (from Phase 9)
- `packages/config/src/env-schema.ts` — Global env schema

### Research
- `.planning/research/ARCHITECTURE.md` — DrizzleModule design, pgSchema patterns
- `.planning/research/STACK.md` — Package versions (drizzle-orm, pg)
- `.planning/research/PITFALLS.md` — Connection lifecycle, Drizzle type leaking

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `LoggingModule` — reference for dynamic module with static factory methods and ConfigService DI
- `RedisHealthIndicator` / `RabbitMqHealthIndicator` — reference for HealthIndicatorService usage pattern
- Foundation barrel export (`index.ts`) — established pattern for re-exporting modules

### Established Patterns
- Dynamic modules return `DynamicModule` with imports, providers, exports
- Global providers via `APP_FILTER`, `APP_INTERCEPTOR` tokens
- Health indicators use `HealthIndicatorService.check(key).up()` / `.down()` from @nestjs/terminus
- Graceful shutdown via `OnApplicationShutdown` interface (Phase 7 pattern)

### Integration Points
- Foundation `index.ts` — new exports: PersistenceModule, DATABASE_HEALTH token, DatabaseHealthIndicator interface
- `package.json` — new deps: drizzle-orm, pg, @types/pg
- Future consumers: auth.module.ts, sender.module.ts, parser.module.ts, audience.module.ts (Phase 12-13)

</code_context>

<specifics>
## Specific Ideas

- PersistenceModule is the facade — same concept as LoggingModule hiding Pino internals
- Each phase must verify all 6 services start and health checks pass (user requirement)
- DrizzleModule and PostgresHealthModule are internal to foundation — not advertised to services

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 10-foundation-drizzlemodule-health*
*Context gathered: 2026-04-04*
