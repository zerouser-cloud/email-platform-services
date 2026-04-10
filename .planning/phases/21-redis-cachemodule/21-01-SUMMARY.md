---
phase: 21-redis-cachemodule
plan: 01
subsystem: infra
tags: [redis, ioredis, nestjs, cache, di, health-check]

requires:
  - phase: 20-config-decomposition
    provides: modular config with per-service env schemas
provides:
  - CacheModule.forRootAsync({ namespace }) in foundation
  - CachePort interface with get/set/del and mandatory TTL
  - CACHE_SERVICE and REDIS_HEALTH Symbol DI tokens
  - RedisHealthIndicator with real PING check
  - RedisShutdownService with graceful quit
  - RedisCacheService with namespace-prefixed keys
affects: [21-02 service integration, sender, parser, audience, auth]

tech-stack:
  added: [ioredis]
  patterns: [CacheModule mirroring PersistenceModule forRootAsync pattern, namespace-prefixed key isolation]

key-files:
  created:
    - packages/foundation/src/cache/cache.interfaces.ts
    - packages/foundation/src/cache/cache.constants.ts
    - packages/foundation/src/cache/cache.service.ts
    - packages/foundation/src/cache/redis.health.ts
    - packages/foundation/src/cache/redis-shutdown.service.ts
    - packages/foundation/src/cache/cache.providers.ts
    - packages/foundation/src/cache/cache.module.ts
    - packages/foundation/src/cache/index.ts
  modified:
    - packages/foundation/package.json
    - packages/foundation/src/index.ts

key-decisions:
  - "Export RedisHealthIndicator from cache barrel for downstream backward compatibility"

patterns-established:
  - "CacheModule follows PersistenceModule pattern: forRootAsync, Symbol tokens, health indicator, shutdown service"
  - "REDIS_CLIENT is internal-only -- not exported from barrel (encapsulation)"
  - "Mandatory TTL on every set() call prevents unbounded memory growth"
  - "Namespace prefix isolates per-service keys automatically"

requirements-completed: [CACHE-01, CACHE-02, CACHE-03, CACHE-04]

duration: 2min
completed: 2026-04-08
---

# Phase 21 Plan 01: CacheModule Foundation Summary

**CacheModule with ioredis in foundation -- DI tokens, namespace-prefixed CachePort, PING health indicator, graceful shutdown**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-08T17:06:53Z
- **Completed:** 2026-04-08T17:09:04Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- CacheModule.forRootAsync({ namespace }) available from @email-platform/foundation
- CachePort interface with get<T>/set/del and mandatory ttlMs parameter
- Real Redis PING-based health indicator replacing old stub
- Graceful Redis shutdown on application termination

## Task Commits

Each task was committed atomically:

1. **Task 1: Install ioredis and create all CacheModule files** - `c28bc35` (feat)
2. **Task 2: Wire CacheModule into foundation exports and delete old Redis health stub** - `754d73a` (feat)

## Files Created/Modified
- `packages/foundation/src/cache/cache.interfaces.ts` - CachePort, CacheHealthIndicator, CacheModuleOptions interfaces
- `packages/foundation/src/cache/cache.constants.ts` - CACHE_SERVICE, REDIS_HEALTH, REDIS_CLIENT symbols + REDIS_DEFAULTS, REDIS_HEALTH_CHECK constants
- `packages/foundation/src/cache/cache.service.ts` - RedisCacheService implementing CachePort with namespace prefix
- `packages/foundation/src/cache/redis.health.ts` - RedisHealthIndicator with real PING check
- `packages/foundation/src/cache/redis-shutdown.service.ts` - RedisShutdownService calling redis.quit()
- `packages/foundation/src/cache/cache.providers.ts` - cacheProviders(options) factory function
- `packages/foundation/src/cache/cache.module.ts` - CacheModule with forRootAsync static method
- `packages/foundation/src/cache/index.ts` - Barrel exports for cache module
- `packages/foundation/package.json` - Added ioredis dependency
- `packages/foundation/src/index.ts` - Replaced old Redis stub export with cache barrel
- `packages/foundation/src/health/indicators/redis.health.ts` - DELETED (old stub)

## Decisions Made
- Exported RedisHealthIndicator from cache barrel to maintain backward compat with sender app which imports it directly

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Export RedisHealthIndicator from cache barrel**
- **Found during:** Task 2 (wire exports, delete stub)
- **Issue:** Sender app imports `RedisHealthIndicator` by name from `@email-platform/foundation`. The plan's cache barrel only exported types, not the class itself. Sender build failed with TS2724.
- **Fix:** Added `export { RedisHealthIndicator } from './redis.health'` to cache/index.ts
- **Files modified:** packages/foundation/src/cache/index.ts
- **Verification:** `pnpm build --filter=@email-platform/sender` succeeds
- **Committed in:** 754d73a (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix necessary for backward compatibility. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CacheModule ready for service integration in Plan 02
- Services can import CacheModule.forRootAsync({ namespace: 'serviceName' })
- REDIS_URL env var needed in service env schemas (Plan 02 scope)

---
*Phase: 21-redis-cachemodule*
*Completed: 2026-04-08*
