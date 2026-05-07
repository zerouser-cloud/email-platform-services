import { Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { PinoLogger } from 'nestjs-pino';
import type { Logger as PinoBaseLogger } from 'pino';
import type { ZodType } from 'zod';
import type { CacheGetResult, CachePort } from './cache.interfaces';

@Injectable()
export class RedisCacheService implements CachePort {
  private readonly prefix: string;
  private _logger?: PinoBaseLogger;

  constructor(
    private readonly redis: Redis,
    namespace: string,
  ) {
    this.prefix = `${namespace}:`;
  }

  // TEMP: foundation logger DI pattern under design — see Phase 999.20 (Logger Port).
  // 7 foundation sites currently use PinoLogger directly через 3 разных способа
  // (auto-context inference / setContext / root.child). LoggerPort Tier-1 abstraction
  // TBD; current `PinoLogger.root.child(...)` is tactical, not architectural.
  private get logger(): PinoBaseLogger {
    if (!this._logger) {
      this._logger = PinoLogger.root.child({ context: RedisCacheService.name });
    }
    return this._logger;
  }

  async get<T>(key: string, schema?: ZodType<T>): Promise<CacheGetResult<T>> {
    const prefixed = this.prefixKey(key);
    const raw = await this.redis.get(prefixed);
    if (raw === null) {
      return { status: 'absent' };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      this.logger.error({ key: prefixed, err }, 'cache: JSON.parse failed; deleting corrupt entry');
      try {
        await this.del(key);
      } catch (delErr) {
        this.logger.error(
          { key: prefixed, delErr },
          'cache: self-heal del() failed; corrupt entry persists',
        );
      }
      return { status: 'corrupt', reason: 'json-parse' };
    }

    if (!schema) {
      return { status: 'value', value: parsed as T };
    }

    const result = schema.safeParse(parsed);
    if (!result.success) {
      this.logger.warn(
        { key: prefixed, issues: result.error.issues },
        'cache: schema mismatch; deleting corrupt entry',
      );
      try {
        await this.del(key);
      } catch (delErr) {
        this.logger.error(
          { key: prefixed, delErr },
          'cache: self-heal del() failed; corrupt entry persists',
        );
      }
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
