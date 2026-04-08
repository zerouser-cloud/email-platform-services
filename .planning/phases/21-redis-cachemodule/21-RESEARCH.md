# Phase 21: Redis CacheModule - Research

**Researched:** 2026-04-08
**Domain:** NestJS dynamic module for Redis caching via ioredis with DI, health monitoring, namespace isolation
**Confidence:** HIGH

## Summary

This phase creates a CacheModule in `packages/foundation/src/cache/` that exactly mirrors the PersistenceModule pattern. The module wraps ioredis behind a `CachePort` abstraction (get/set/del with mandatory TTL), provides a real health indicator (replacing the stub), graceful shutdown, and per-service namespace isolation via `forRootAsync({ namespace })`.

The implementation is straightforward because: (1) PersistenceModule provides a battle-tested structural template, (2) RedisSchema already exists and REDIS_URL is in all .env files, (3) ioredis 5.10.1 is the standard Node.js Redis client with built-in reconnection, and (4) only sender currently imports the Redis health stub, so migration is contained.

**Primary recommendation:** Clone PersistenceModule structure file-by-file, replace pg with ioredis, expose only CachePort (not raw client), add namespace prefixing in RedisCacheService.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Redis only for cache in current milestone. Get/set/del + TTL is the full API
- **D-02:** Sessions, rate-limiting, pub/sub are out of scope
- **D-03:** Legacy project confirms: Redis used only for task tracking (set/get/del with TTL)
- **D-04:** CacheModule exports only CachePort abstraction via CACHE_SERVICE token. No raw REDIS_CLIENT export
- **D-05:** CachePort interface: `get<T>(key): Promise<T | null>`, `set(key, value, ttlMs): Promise<void>`, `del(key): Promise<void>`
- **D-06:** TTL is mandatory parameter in set() -- cache without TTL is memory leak
- **D-07:** If specific operations needed (incr, exists, expire) -- separate abstraction, not raw client access
- **D-08:** Auto-prefix via `forRootAsync({ namespace: 'sender' })`. CacheService transparently adds `{namespace}:` to every key
- **D-09:** Analogy with pgSchema in PersistenceModule -- isolation at module level, not convention
- **D-10:** Service writes `campaign:123`, Redis stores `sender:campaign:123`
- **D-11:** Everything in `packages/foundation/src/cache/` directory
- **D-12:** Files: cache.module.ts, cache.constants.ts, cache.providers.ts, cache.service.ts, cache.interfaces.ts, redis.health.ts, redis-shutdown.service.ts, index.ts
- **D-13:** Old `health/indicators/redis.health.ts` (stub) gets deleted -- replaced by real redis.health.ts inside cache/
- **D-14:** `forRootAsync({ namespace: string })` -- single parameter. REDIS_URL from ConfigService
- **D-15:** Tokens: CACHE_SERVICE (Symbol), REDIS_HEALTH (Symbol). No REDIS_CLIENT

### Claude's Discretion
- Internal namespace prefix implementation (in RedisCacheService constructor vs in each method)
- ioredis connection options (keepAlive, retryStrategy)
- Serialization format (JSON.stringify/parse)
- Redis health check implementation (PING vs INFO)

### Deferred Ideas (OUT OF SCOPE)
- Token revocation / session storage -- separate abstraction when use case appears
- PG_POOL export from PersistenceModule -- backlog 999.3
- Rate limiting via Redis -- separate ThrottlerStorage adapter if needed
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CACHE-01 | CacheModule in foundation with `forRootAsync()`, Symbol DI tokens, health indicator, shutdown service | PersistenceModule pattern fully documented; ioredis verified at 5.10.1; file structure defined in D-12 |
| CACHE-02 | Service can inject Redis client via DI token and perform get/set/del operations | CachePort interface defined in D-05; CACHE_SERVICE Symbol token; RedisCacheService implements with JSON serialization |
| CACHE-03 | Health indicator reflects real Redis connection state (replacing stub) | PostgresHealthIndicator pattern documented; Redis PING command for health; stub deletion path identified |
| CACHE-04 | Per-service namespace isolation (keys don't collide between services) | forRootAsync({ namespace }) pattern; auto-prefix in RedisCacheService; sender currently only consumer |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ioredis | 5.10.1 | Redis client | De facto standard for Node.js Redis. Built-in reconnection, Lua scripting, cluster support. Used by Bull, BullMQ, NestJS cache-manager backends [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @nestjs/terminus | 11.1.1 | Health check framework | Already installed, used for Redis health indicator |
| @nestjs/config | 4.0.3 | ConfigService for REDIS_URL | Already installed, inject in providers |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ioredis | redis (node-redis) | node-redis 4.x is official but ioredis has better TypeScript support, more mature reconnection, wider ecosystem adoption in NestJS projects |
| ioredis | @nestjs/cache-manager | Over-abstracted for our needs (just get/set/del), adds cache-manager dependency, doesn't give namespace control |

**Installation:**
```bash
pnpm add -w ioredis
pnpm add -wD @types/ioredis  # Not needed -- ioredis ships its own types since v5
```

Note: ioredis 5.x ships built-in TypeScript types. No `@types/ioredis` needed. [VERIFIED: npm registry -- ioredis package includes types field]

**Version verification:**
```
ioredis: 5.10.1 (verified via npm view, 2026-04-08)
```

## Architecture Patterns

### Recommended Project Structure
```
packages/foundation/src/cache/
  cache.module.ts           # DynamicModule with forRootAsync({ namespace })
  cache.constants.ts        # CACHE_SERVICE, REDIS_HEALTH symbols + REDIS_DEFAULTS
  cache.providers.ts        # Provider array (redis client, cache service, health, shutdown)
  cache.service.ts          # RedisCacheService implements CachePort
  cache.interfaces.ts       # CachePort interface + CacheModuleOptions
  redis.health.ts           # RedisHealthIndicator (real PING check)
  redis-shutdown.service.ts # Graceful disconnect on shutdown
  index.ts                  # Barrel exports
```

### Pattern 1: PersistenceModule Mirror
**What:** Exact structural copy of PersistenceModule with Redis-specific internals
**When to use:** Every infrastructure module in this project

**Reference: PersistenceModule structure (source of truth)**
```
persistence.module.ts      -> cache.module.ts
persistence.constants.ts   -> cache.constants.ts
persistence.providers.ts   -> cache.providers.ts
persistence.interfaces.ts  -> cache.interfaces.ts
postgres.health.ts         -> redis.health.ts
drizzle-shutdown.service.ts -> redis-shutdown.service.ts
index.ts                   -> index.ts
(new)                      -> cache.service.ts (CachePort implementation)
```

The one addition vs PersistenceModule: `cache.service.ts` -- PersistenceModule exposes Drizzle directly (raw ORM), but CacheModule wraps ioredis behind CachePort abstraction per D-04.

### Pattern 2: forRootAsync with namespace parameter
**What:** Module accepts namespace for key isolation, reads REDIS_URL from ConfigService
**Example:**
```typescript
// Source: project pattern from PersistenceModule + CONTEXT.md D-14
@Module({})
export class CacheModule {
  static forRootAsync(options: CacheModuleOptions): DynamicModule {
    return {
      module: CacheModule,
      imports: [TerminusModule],
      providers: [...cacheProviders(options)],
      exports: [TerminusModule, CACHE_SERVICE, REDIS_HEALTH],
    };
  }
}
```

Key difference from PersistenceModule: providers is a function `cacheProviders(options)` not a static array, because namespace must be passed through to RedisCacheService.

### Pattern 3: Namespace-Prefixed CacheService
**What:** RedisCacheService transparently prefixes all keys with `{namespace}:`
**Example:**
```typescript
// Source: CONTEXT.md D-08, D-09, D-10
@Injectable()
export class RedisCacheService implements CachePort {
  private readonly prefix: string;

  constructor(
    private readonly redis: Redis,
    namespace: string,
  ) {
    this.prefix = `${namespace}:`;
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(this.prefixKey(key));
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  }

  async set(key: string, value: unknown, ttlMs: number): Promise<void> {
    await this.redis.set(this.prefixKey(key), JSON.stringify(value), 'PX', ttlMs);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(this.prefixKey(key));
  }

  private prefixKey(key: string): string {
    return `${this.prefix}${key}`;
  }
}
```

### Anti-Patterns to Avoid
- **Exporting raw Redis client:** Violates D-04, D-07. Consumers must use CachePort only
- **Optional TTL in set():** Violates D-06. Cache without TTL is memory leak
- **String DI tokens:** Project uses Symbol tokens exclusively (no-magic-values skill)
- **Default values in connection config:** No fallbacks -- REDIS_URL must come from ConfigService which gets it from validated env schema

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Redis client | Custom socket wrapper | ioredis | Reconnection, pipelining, Lua scripting, cluster support |
| Health checks | Custom TCP ping | @nestjs/terminus HealthIndicatorService | Consistent with PostgresHealthIndicator pattern |
| Serialization | Custom binary format | JSON.stringify/parse | Simple, debuggable, sufficient for cache values |
| Reconnection | Custom retry loop | ioredis built-in retryStrategy | Handles edge cases: connection drops, DNS resolution, backoff |

## Common Pitfalls

### Pitfall 1: ioredis Connection URL parsing
**What goes wrong:** ioredis constructor accepts URL string directly, but some connection options may conflict with URL parameters
**Why it happens:** `new Redis(url)` and `new Redis(url, options)` have different merge behaviors
**How to avoid:** Pass URL as first argument, keep options minimal. Do not duplicate host/port in options if already in URL
**Warning signs:** Connection timeouts, "WRONGPASS" errors when URL has auth but options override it

### Pitfall 2: Forgetting PX vs EX in TTL
**What goes wrong:** Using `EX` (seconds) when code passes milliseconds, or vice versa
**Why it happens:** Redis SET supports both `EX` (seconds) and `PX` (milliseconds)
**How to avoid:** CachePort interface uses `ttlMs` (milliseconds) consistently. Implementation uses `PX` flag. Document in interface JSDoc
**Warning signs:** Cache entries expiring 1000x too fast or too slow

### Pitfall 3: JSON.parse on non-JSON values
**What goes wrong:** If a raw string was stored (e.g., by another system), JSON.parse throws
**Why it happens:** No validation that stored value is valid JSON
**How to avoid:** Since only CachePort writes values (no raw client export), all values are JSON.stringify'd. Wrap JSON.parse in try/catch returning null for safety
**Warning signs:** Unhandled promise rejections from get()

### Pitfall 4: Not disconnecting on shutdown
**What goes wrong:** ioredis keeps reconnection attempts alive, preventing Node.js process from exiting
**Why it happens:** ioredis has aggressive reconnection by default
**How to avoid:** RedisShutdownService calls `redis.quit()` (graceful) not `redis.disconnect()` (forced). `quit()` waits for pending commands
**Warning signs:** Process hangs on SIGTERM, Docker container killed after timeout

### Pitfall 5: Shared ioredis instance across modules
**What goes wrong:** Multiple CacheModule.forRootAsync() calls in different services create separate connections but that's expected (one per service process)
**Why it happens:** Each microservice is a separate process
**How to avoid:** This is correct behavior -- each service process has one Redis connection
**Warning signs:** None -- this is the expected pattern

### Pitfall 6: Health check during reconnection
**What goes wrong:** PING fails during reconnection, health check reports down, orchestrator restarts container
**Why it happens:** ioredis reconnects automatically but PING throws during reconnection
**How to avoid:** Health check should catch the error and return `down()` -- this is the correct behavior. Do not silence the error. Let the health check honestly report the state
**Warning signs:** Restart loops if health check interval < reconnection time

## Code Examples

### cache.interfaces.ts
```typescript
// Source: CONTEXT.md D-05
import type { HealthIndicatorResult } from '@nestjs/terminus';

export interface CachePort {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlMs: number): Promise<void>;
  del(key: string): Promise<void>;
}

export interface CacheHealthIndicator {
  isHealthy(key: string): Promise<HealthIndicatorResult>;
}

export interface CacheModuleOptions {
  namespace: string;
}
```

### cache.constants.ts
```typescript
// Source: project pattern from persistence.constants.ts + CONTEXT.md D-15
export const CACHE_SERVICE = Symbol('CACHE_SERVICE');
export const REDIS_HEALTH = Symbol('REDIS_HEALTH');

export const REDIS_DEFAULTS = {
  KEEP_ALIVE_MS: 10_000,
  CONNECT_TIMEOUT_MS: 5_000,
  MAX_RETRIES_PER_REQUEST: 3,
  RECONNECT_MAX_DELAY_MS: 5_000,
} as const;

export const REDIS_HEALTH_CHECK = {
  COMMAND: 'PING',
  DOWN_MESSAGE: 'Redis connection failed',
} as const;
```

### cache.providers.ts (provider factory function)
```typescript
// Source: persistence.providers.ts pattern adapted for parameterized module
import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CACHE_SERVICE, REDIS_HEALTH, REDIS_DEFAULTS } from './cache.constants';
import type { CacheModuleOptions } from './cache.interfaces';
import { RedisCacheService } from './cache.service';
import { RedisHealthIndicator } from './redis.health';
import { RedisShutdownService } from './redis-shutdown.service';

// Internal token -- not exported from module
const REDIS_CLIENT = Symbol('REDIS_CLIENT');

export const cacheProviders = (options: CacheModuleOptions): Provider[] => [
  {
    provide: REDIS_CLIENT,
    inject: [ConfigService],
    useFactory: (config: ConfigService): Redis =>
      new Redis(config.get<string>('REDIS_URL')!, {
        keepAlive: REDIS_DEFAULTS.KEEP_ALIVE_MS,
        connectTimeout: REDIS_DEFAULTS.CONNECT_TIMEOUT_MS,
        maxRetriesPerRequest: REDIS_DEFAULTS.MAX_RETRIES_PER_REQUEST,
      }),
  },
  {
    provide: CACHE_SERVICE,
    inject: [REDIS_CLIENT],
    useFactory: (redis: Redis): RedisCacheService =>
      new RedisCacheService(redis, options.namespace),
  },
  {
    provide: REDIS_HEALTH,
    useExisting: RedisHealthIndicator,
  },
  {
    provide: RedisHealthIndicator,
    inject: [REDIS_CLIENT],
    useFactory: (redis: Redis) =>
      // HealthIndicatorService injected separately -- see implementation
      // This may need adjustment based on TerminusModule DI
      redis,
  },
  RedisShutdownService,
];
```

Note: The REDIS_CLIENT symbol is internal to providers.ts -- not exported from the module. This enforces D-04.

### Service consumption pattern
```typescript
// Source: CONTEXT.md D-08, D-10 + sender.module.ts pattern
// In sender.module.ts:
import { CacheModule } from '@email-platform/foundation';

@Module({
  imports: [
    AppConfigModule.forRoot(SenderEnvSchema),
    PersistenceModule.forRootAsync(),
    CacheModule.forRootAsync({ namespace: 'sender' }),
    LoggingModule.forGrpcAsync('sender'),
  ],
  // ...
})
export class SenderModule {}

// In a use case or service:
import { CACHE_SERVICE, type CachePort } from '@email-platform/foundation';

@Injectable()
export class SomeService {
  constructor(@Inject(CACHE_SERVICE) private readonly cache: CachePort) {}

  async getCampaign(id: string): Promise<Campaign | null> {
    return this.cache.get<Campaign>(`campaign:${id}`);
    // Actually stored as sender:campaign:123 in Redis
  }
}
```

### Health controller migration (sender)
```typescript
// Source: apps/sender/src/health/health.controller.ts (current) -> migrated
import { HEALTH, DATABASE_HEALTH, REDIS_HEALTH } from '@email-platform/foundation';
import type { DatabaseHealthIndicator, CacheHealthIndicator } from '@email-platform/foundation';

@Controller(HEALTH.ROUTE)
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    @Inject(DATABASE_HEALTH) private readonly db: DatabaseHealthIndicator,
    @Inject(REDIS_HEALTH) private readonly redis: CacheHealthIndicator,
  ) {}

  @Get(HEALTH.READY)
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.db.isHealthy(HEALTH.INDICATOR.POSTGRESQL),
      () => this.redis.isHealthy(HEALTH.INDICATOR.REDIS),
    ]);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| node-redis v3 (callback-based) | ioredis 5.x (Promise-native, TypeScript) | ioredis dominant since ~2020 | Better DX, built-in types |
| @nestjs/cache-manager | Direct ioredis + custom abstraction | NestJS cache-manager works but over-abstracts | More control, simpler dependencies |
| String DI tokens | Symbol DI tokens | Project convention | Type-safe, no collision risk |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | ioredis constructor accepts URL string as first arg: `new Redis('redis://host:6379')` | Code Examples | Connection would fail -- LOW risk, well-documented ioredis feature [ASSUMED] |
| A2 | ioredis SET with PX flag: `redis.set(key, value, 'PX', ttlMs)` for millisecond TTL | Code Examples | TTL would not work -- LOW risk, standard Redis SET command [ASSUMED] |
| A3 | `redis.quit()` is graceful (waits for pending), `redis.disconnect()` is forceful | Pitfalls | Shutdown behavior difference -- LOW risk, documented ioredis behavior [ASSUMED] |
| A4 | ioredis `ping()` method returns 'PONG' on success | Code Examples | Health check implementation -- LOW risk, standard Redis PING [ASSUMED] |

All assumptions are standard ioredis API behaviors with very low risk of being incorrect.

## Open Questions

1. **RedisHealthIndicator DI for HealthIndicatorService**
   - What we know: PostgresHealthIndicator injects HealthIndicatorService via constructor (provided by TerminusModule)
   - What's unclear: When using useFactory in providers, HealthIndicatorService injection needs to be handled differently since we're constructing the instance manually
   - Recommendation: Make RedisHealthIndicator a regular @Injectable class (like PostgresHealthIndicator) and use `useExisting` alias for REDIS_HEALTH token. The Redis client can be injected via the internal REDIS_CLIENT token

2. **Audience service -- does it need Redis?**
   - What we know: Audience env schema does NOT include RedisSchema currently. Sender does.
   - What's unclear: Whether audience should add CacheModule in this phase
   - Recommendation: Only add CacheModule to sender in this phase (it already has RedisSchema). Other services add when they have cache use cases

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Redis | CacheModule | via Docker Compose | 7-alpine | -- (required) |
| REDIS_URL env var | ConfigService | all 3 .env files | -- | -- (already configured) |
| ioredis npm package | cache.service.ts | not yet installed | 5.10.1 target | -- (must install) |

**Missing dependencies with no fallback:**
- ioredis package -- must be installed via `pnpm add ioredis` in packages/foundation

**Missing dependencies with fallback:**
- None

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None -- testing is out of scope per CLAUDE.md |
| Config file | None |
| Quick run command | `pnpm build` (TypeScript compilation) |
| Full suite command | `pnpm build && pnpm lint` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CACHE-01 | Module structure, DI tokens, health, shutdown | manual-only | `pnpm build` (compile check) | N/A |
| CACHE-02 | get/set/del operations via CachePort | manual-only | Start service + Redis, verify operations | N/A |
| CACHE-03 | Health indicator PING check | manual-only | Start service, check /health/ready endpoint | N/A |
| CACHE-04 | Namespace prefixing | manual-only | redis-cli KEYS 'sender:*' after set operation | N/A |

### Sampling Rate
- **Per task commit:** `pnpm build` (typecheck all packages)
- **Per wave merge:** `pnpm build && pnpm lint`
- **Phase gate:** Build passes + manual health check verification

### Wave 0 Gaps
None -- no test framework to set up (testing deferred per project constraints).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | -- |
| V3 Session Management | no | Redis not used for sessions (D-02) |
| V4 Access Control | no | -- |
| V5 Input Validation | yes | CachePort accepts typed keys (string) and values (unknown -> JSON serialized). No user input directly used as cache keys in this phase |
| V6 Cryptography | no | Cache data not encrypted at rest (local Redis, no sensitive data in cache scope) |

### Known Threat Patterns for Redis

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Key injection via user input in cache key | Tampering | Namespace prefix isolates per-service; cache keys constructed by service code, not from raw user input |
| Redis data exposure on unprotected port | Information Disclosure | Redis bound to Docker network, not exposed to host in production |
| Cache poisoning | Tampering | Mandatory TTL ensures stale data expires; CachePort is the only write path |

## Sources

### Primary (HIGH confidence)
- PersistenceModule source code (`packages/foundation/src/persistence/`) -- structural pattern [VERIFIED: codebase]
- RedisSchema source (`packages/config/src/schemas/redis.ts`) -- env validation exists [VERIFIED: codebase]
- Redis health stub (`packages/foundation/src/health/indicators/redis.health.ts`) -- stub to replace [VERIFIED: codebase]
- Sender module (`apps/sender/src/sender.module.ts`) -- current Redis stub usage [VERIFIED: codebase]
- ioredis 5.10.1 -- latest version [VERIFIED: npm registry]
- REDIS_URL in .env, .env.docker, .env.example -- already configured [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- ioredis API (constructor URL, SET PX, quit vs disconnect) [ASSUMED -- standard well-known API]

### Tertiary (LOW confidence)
- None

## Project Constraints (from CLAUDE.md)

- **Architecture apps/**: Clean/DDD/Hexagonal
- **Architecture packages/**: Simple utility structure, no DDD
- **No business logic**: Only structural scaffolding
- **No tests**: Testing is a separate future milestone
- **No magic values**: Extract to named `as const` objects, Symbol DI tokens
- **No switch/case, no if/else chains (3+ branches)**
- **No environment branching**: No NODE_ENV checks, all config via @email-platform/config
- **No infrastructure changes without user approval**: Do not change ports, docker-compose, .env files
- **No defaults or optionals in env schemas**: Every env var required, every value from .env files
- **No fallbacks in consumer code**: Trust the schema

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- ioredis verified, single dependency
- Architecture: HIGH -- PersistenceModule pattern is exact template, all files identified
- Pitfalls: HIGH -- well-known Redis/ioredis patterns, low complexity

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (stable domain, low churn)
