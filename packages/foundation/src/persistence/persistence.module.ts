import { Module, type DynamicModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE, PG_POOL, DATABASE_HEALTH } from './persistence.constants';
import { DrizzleShutdownService } from './drizzle-shutdown.service';
import { PostgresHealthIndicator } from './postgres.health';

@Module({})
export class PersistenceModule {
  static forRootAsync(): DynamicModule {
    return {
      module: PersistenceModule,
      imports: [TerminusModule],
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
        PostgresHealthIndicator,
        { provide: DATABASE_HEALTH, useExisting: PostgresHealthIndicator },
      ],
      exports: [TerminusModule, DRIZZLE, PG_POOL, DATABASE_HEALTH],
    };
  }
}
