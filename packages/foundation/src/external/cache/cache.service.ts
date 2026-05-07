import { Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { PinoLogger } from 'nestjs-pino';
import type { ZodType } from 'zod';
import type { CacheGetResult, CachePort } from './cache.interfaces';

@Injectable()
export class RedisCacheService implements CachePort {
  private readonly prefix: string;

  constructor(
    private readonly redis: Redis,
    private readonly logger: PinoLogger,
    namespace: string,
  ) {
    this.prefix = `${namespace}:`;
    this.logger.setContext(RedisCacheService.name);
  }

  async get<T>(key: string, schema?: ZodType<T>): Promise<CacheGetResult<T>> {
    const raw = await this.redis.get(this.prefixKey(key));
    if (raw === null) {
      return { status: 'absent' };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      this.logger.error(
        { key: this.prefixKey(key), err },
        'cache: JSON.parse failed; deleting corrupt entry',
      );
      await this.del(key);
      return { status: 'corrupt', reason: 'json-parse' };
    }

    if (!schema) {
      return { status: 'value', value: parsed as T };
    }

    const result = schema.safeParse(parsed);
    if (!result.success) {
      this.logger.warn(
        { key: this.prefixKey(key), issues: result.error.issues },
        'cache: schema mismatch; deleting corrupt entry',
      );
      await this.del(key);
      return { status: 'corrupt', reason: 'schema-mismatch' };
    }

    return { status: 'value', value: result.data };
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
