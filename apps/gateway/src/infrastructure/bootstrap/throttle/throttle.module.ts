import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { REDIS_CLIENT, type RedisClient } from '@email-platform/foundation';
import { GATEWAY_CONFIG } from '../config/gateway-config.constants';
import type { GatewayEnv } from '@email-platform/config';
import { THROTTLE_TIER } from './throttle.constants';
import { AppCacheModule } from '../../outbound/cache';

@Module({
  imports: [
    AppCacheModule,
    ThrottlerModule.forRootAsync({
      // Phase 999.12-12 hotfix: forRootAsync useFactory resolves dependencies in
      // its OWN module context, not the wrapper ThrottleModule's. Without explicit
      // imports here, REDIS_CLIENT (exported by AppCacheModule) is unreachable to
      // the factory and DI fails at boot. Canonical NestJS pattern for cross-module
      // forRootAsync injection.
      imports: [AppCacheModule],
      inject: [GATEWAY_CONFIG, REDIS_CLIENT],
      useFactory: (config: GatewayEnv, redis: RedisClient) => ({
        throttlers: [
          {
            name: THROTTLE_TIER.BURST,
            ttl: config.RATE_LIMIT_BURST_TTL,
            limit: config.RATE_LIMIT_BURST_LIMIT,
          },
          {
            name: THROTTLE_TIER.SUSTAINED,
            ttl: config.RATE_LIMIT_SUSTAINED_TTL,
            limit: config.RATE_LIMIT_SUSTAINED_LIMIT,
          },
        ],
        storage: new ThrottlerStorageRedisService(redis),
      }),
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class ThrottleModule {}
