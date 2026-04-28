import type { Provider } from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  DRIZZLE,
  PG_POOL,
  PERSISTENCE_HEALTH,
  PG_POOL_DEFAULTS,
  PERSISTENCE_CONFIG_PORT,
} from './persistence.constants';
import type { PersistenceConfig } from './persistence.interfaces';
import { DrizzleShutdownService } from './drizzle-shutdown.service';
import { PostgresHealthIndicator } from './postgres.health';

const pgPoolProvider: Provider = {
  provide: PG_POOL,
  inject: [PERSISTENCE_CONFIG_PORT],
  useFactory: (config: PersistenceConfig): Pool =>
    new Pool({
      connectionString: config.DATABASE_URL,
      max: PG_POOL_DEFAULTS.MAX_CONNECTIONS,
      idleTimeoutMillis: PG_POOL_DEFAULTS.IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: PG_POOL_DEFAULTS.CONNECTION_TIMEOUT_MS,
    }),
};

const drizzleProvider: Provider = {
  provide: DRIZZLE,
  inject: [PG_POOL],
  useFactory: (pool: Pool): NodePgDatabase => drizzle({ client: pool }),
};

const persistenceHealthProvider: Provider = {
  provide: PERSISTENCE_HEALTH,
  useExisting: PostgresHealthIndicator,
};

export const persistenceProviders: Provider[] = [
  pgPoolProvider,
  drizzleProvider,
  DrizzleShutdownService,
  PostgresHealthIndicator,
  persistenceHealthProvider,
];
