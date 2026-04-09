export const CACHE_SERVICE = Symbol('CACHE_SERVICE');
export const REDIS_HEALTH = Symbol('REDIS_HEALTH');
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

export const REDIS_DEFAULTS = {
  KEEP_ALIVE_MS: 10_000,
  CONNECT_TIMEOUT_MS: 5_000,
  MAX_RETRIES_PER_REQUEST: 3,
} as const;

export const REDIS_HEALTH_CHECK = {
  COMMAND: 'PING',
  DOWN_MESSAGE: 'Redis connection failed',
} as const;
