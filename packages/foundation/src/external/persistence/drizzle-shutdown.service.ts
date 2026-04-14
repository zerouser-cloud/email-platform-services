import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from './persistence.constants';

@Injectable()
export class DrizzleShutdownService implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(_signal?: string): Promise<void> {
    await this.pool.end();
  }
}
