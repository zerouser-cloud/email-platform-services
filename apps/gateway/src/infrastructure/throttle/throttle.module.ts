import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { GATEWAY_CONFIG } from '../../gateway.constants';
import type { GatewayEnv } from '../config';

const THROTTLE_TIER = {
  BURST: 'burst',
  SUSTAINED: 'sustained',
} as const;

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [GATEWAY_CONFIG],
      useFactory: (config: GatewayEnv) => ({
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
      }),
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class ThrottleModule {}
