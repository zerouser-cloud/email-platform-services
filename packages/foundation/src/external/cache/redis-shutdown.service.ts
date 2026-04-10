import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from './cache.constants';

@Injectable()
export class RedisShutdownService implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onApplicationShutdown(_signal?: string): Promise<void> {
    await this.redis.quit();
  }
}
