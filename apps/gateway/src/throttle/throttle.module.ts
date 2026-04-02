import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

const THROTTLE_TIER = {
  BURST: 'burst',
  SUSTAINED: 'sustained',
} as const;

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            name: THROTTLE_TIER.BURST,
            ttl: configService.get<number>('RATE_LIMIT_BURST_TTL')!,
            limit: configService.get<number>('RATE_LIMIT_BURST_LIMIT')!,
          },
          {
            name: THROTTLE_TIER.SUSTAINED,
            ttl: configService.get<number>('RATE_LIMIT_SUSTAINED_TTL')!,
            limit: configService.get<number>('RATE_LIMIT_SUSTAINED_LIMIT')!,
          },
        ],
      }),
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class ThrottleModule {}
