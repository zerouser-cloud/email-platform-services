import { Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import type { CachePort } from './cache.interfaces';

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
    if (raw === null) {
      return null;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
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
