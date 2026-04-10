export const DRIZZLE = Symbol('DRIZZLE');
export const PG_POOL = Symbol('PG_POOL');
export const DATABASE_HEALTH = Symbol('DATABASE_HEALTH');

export const PG_POOL_DEFAULTS = {
  MAX_CONNECTIONS: 10,
  IDLE_TIMEOUT_MS: 30_000,
  CONNECTION_TIMEOUT_MS: 5_000,
} as const;

export const COLUMN_LENGTH = {
  SHORT: 50,
  MEDIUM: 100,
  DEFAULT: 255,
} as const;

export const PG_HEALTH = {
  QUERY: 'SELECT 1',
  DOWN_MESSAGE: 'PostgreSQL connection failed',
} as const;
