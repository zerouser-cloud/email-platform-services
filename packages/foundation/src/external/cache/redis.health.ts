import { Inject, Injectable } from '@nestjs/common';
import { type HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import type Redis from 'ioredis';
import { REDIS_CLIENT, REDIS_HEALTH_CHECK } from './cache.constants';
import type { CacheHealthIndicator } from './cache.interfaces';

@Injectable()
export class RedisHealthIndicator implements CacheHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      await this.redis.ping();
      return indicator.up();
    } catch {
      return indicator.down({ message: REDIS_HEALTH_CHECK.DOWN_MESSAGE });
    }
  }
}
