import { Inject, Injectable } from '@nestjs/common';
import { type HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import { Pool } from 'pg';
import { PG_POOL } from './persistence.constants';
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
      await this.pool.query('SELECT 1');
      return indicator.up();
    } catch {
      return indicator.down({ message: 'PostgreSQL connection failed' });
    }
  }
}
