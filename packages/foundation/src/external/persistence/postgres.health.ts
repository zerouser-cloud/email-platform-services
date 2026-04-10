import { Inject, Injectable } from '@nestjs/common';
import { type HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import { Pool } from 'pg';
import { PG_POOL, PG_HEALTH } from './persistence.constants';
import type { DatabaseHealthIndicator } from './persistence.interfaces';

@Injectable()
export class PostgresHealthIndicator implements DatabaseHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      await this.pool.query(PG_HEALTH.QUERY);
      return indicator.up();
    } catch {
      return indicator.down({ message: PG_HEALTH.DOWN_MESSAGE });
    }
  }
}
