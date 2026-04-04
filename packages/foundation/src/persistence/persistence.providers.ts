import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE, PG_POOL, DATABASE_HEALTH } from './persistence.constants';
import { DrizzleShutdownService } from './drizzle-shutdown.service';
import { PostgresHealthIndicator } from './postgres.health';

const pgPoolProvider: Provider = {
  provide: PG_POOL,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Pool =>
    new Pool({
      connectionString: config.get<string>('DATABASE_URL'),
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    }),
};

const drizzleProvider: Provider = {
  provide: DRIZZLE,
  inject: [PG_POOL],
  useFactory: (pool: Pool): NodePgDatabase => drizzle({ client: pool }),
};

const databaseHealthProvider: Provider = {
  provide: DATABASE_HEALTH,
  useExisting: PostgresHealthIndicator,
};

export const persistenceProviders: Provider[] = [
  pgPoolProvider,
  drizzleProvider,
  DrizzleShutdownService,
  PostgresHealthIndicator,
  databaseHealthProvider,
];
