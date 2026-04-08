import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CACHE_SERVICE, REDIS_CLIENT, REDIS_HEALTH, REDIS_DEFAULTS } from './cache.constants';
import type { CacheModuleOptions } from './cache.interfaces';
import { RedisCacheService } from './cache.service';
import { RedisHealthIndicator } from './redis.health';
import { RedisShutdownService } from './redis-shutdown.service';

export function cacheProviders(options: CacheModuleOptions): Provider[] {
  const redisClientProvider: Provider = {
    provide: REDIS_CLIENT,
    inject: [ConfigService],
    useFactory: (config: ConfigService): Redis =>
      new Redis(config.get<string>('REDIS_URL')!, {
        keepAlive: REDIS_DEFAULTS.KEEP_ALIVE_MS,
        connectTimeout: REDIS_DEFAULTS.CONNECT_TIMEOUT_MS,
        maxRetriesPerRequest: REDIS_DEFAULTS.MAX_RETRIES_PER_REQUEST,
      }),
  };

  const cacheServiceProvider: Provider = {
    provide: CACHE_SERVICE,
    inject: [REDIS_CLIENT],
    useFactory: (redis: Redis): RedisCacheService =>
      new RedisCacheService(redis, options.namespace),
  };

  const redisHealthProvider: Provider = {
    provide: REDIS_HEALTH,
    useExisting: RedisHealthIndicator,
  };

  return [
    redisClientProvider,
    cacheServiceProvider,
    RedisHealthIndicator,
    redisHealthProvider,
    RedisShutdownService,
  ];
}
