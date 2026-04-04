import { Module, type DynamicModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE, PG_POOL } from './persistence.constants';
import { DrizzleShutdownService } from './drizzle-shutdown.service';

@Module({})
export class DrizzleModule {
  static forRootAsync(): DynamicModule {
    return {
      module: DrizzleModule,
      providers: [
        {
          provide: PG_POOL,
          inject: [ConfigService],
          useFactory: (config: ConfigService): Pool =>
            new Pool({
              connectionString: config.get<string>('DATABASE_URL'),
              max: 10,
              idleTimeoutMillis: 30_000,
              connectionTimeoutMillis: 5_000,
            }),
        },
        {
          provide: DRIZZLE,
          inject: [PG_POOL],
          useFactory: (pool: Pool): NodePgDatabase => drizzle({ client: pool }),
        },
        DrizzleShutdownService,
      ],
      exports: [DRIZZLE, PG_POOL],
    };
  }
}
