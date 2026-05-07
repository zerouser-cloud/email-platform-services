export { CacheModule } from './cache.module';
export {
  CACHE_SERVICE,
  CACHE_HEALTH,
  REDIS_CLIENT, // Phase 999.12 D-13 narrow unlock — see cache.module.ts
  REDIS_DEFAULTS,
  REDIS_HEALTH_CHECK,
  CACHE_CONFIG_PORT,
} from './cache.constants';
export type {
  CacheGetResult,
  CachePort,
  CacheHealthIndicator,
  CacheModuleOptions,
  CacheConfig,
} from './cache.interfaces';
export { RedisHealthIndicator } from './redis.health';
// Phase 999.12 D-13 — type re-export so app code (gateway throttle) annotates
// `redis: RedisClient` without importing from `ioredis` directly. ESLint Override 4
// (D-08) textually bans `from 'ioredis'` in apps/*/src/**; re-exporting here is the
// canonical resolution.
export type { Redis as RedisClient } from 'ioredis';
