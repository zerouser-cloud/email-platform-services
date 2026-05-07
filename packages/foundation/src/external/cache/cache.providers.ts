import type { Provider } from '@nestjs/common';
import Redis from 'ioredis';
import { PinoLogger } from 'nestjs-pino';
import {
  CACHE_SERVICE,
  REDIS_CLIENT,
  CACHE_HEALTH,
  REDIS_DEFAULTS,
  CACHE_CONFIG_PORT,
} from './cache.constants';
import type { CacheConfig, CacheModuleOptions } from './cache.interfaces';
import { RedisCacheService } from './cache.service';
import { RedisHealthIndicator } from './redis.health';
import { RedisShutdownService } from './redis-shutdown.service';

export function cacheProviders(options: CacheModuleOptions): Provider[] {
  const redisClientProvider: Provider = {
    provide: REDIS_CLIENT,
    inject: [CACHE_CONFIG_PORT],
    useFactory: (config: CacheConfig): Redis =>
      new Redis(config.REDIS_URL, {
        keepAlive: REDIS_DEFAULTS.KEEP_ALIVE_MS,
        connectTimeout: REDIS_DEFAULTS.CONNECT_TIMEOUT_MS,
        maxRetriesPerRequest: REDIS_DEFAULTS.MAX_RETRIES_PER_REQUEST,
      }),
  };

  const cacheServiceProvider: Provider = {
    provide: CACHE_SERVICE,
    inject: [REDIS_CLIENT, PinoLogger],
    useFactory: (redis: Redis, logger: PinoLogger): RedisCacheService =>
      new RedisCacheService(redis, logger, options.namespace),
  };

  const cacheHealthProvider: Provider = {
    provide: CACHE_HEALTH,
    useExisting: RedisHealthIndicator,
  };

  return [
    redisClientProvider,
    cacheServiceProvider,
    RedisHealthIndicator,
    cacheHealthProvider,
    RedisShutdownService,
  ];
}
