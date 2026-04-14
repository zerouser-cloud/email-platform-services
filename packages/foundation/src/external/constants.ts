export const HEADER = {
  CORRELATION_ID: 'x-correlation-id',
  FALLBACK_CORRELATION_ID: 'no-correlation-id',
} as const;

export const SERVER = {
  DEFAULT_HOST: '0.0.0.0',
} as const;

export const CORS = {
  WILDCARD: '*',
} as const;

export const CONTEXT_TYPE = {
  RPC: 'rpc',
} as const;

export const HTTP_ERROR = {
  FALLBACK_MESSAGE: 'Internal Server Error',
} as const;

export const LOG_STATUS = {
  OK: 'OK',
  ERROR: 'ERROR',
} as const;

export const BOOTSTRAP = {
  FAILED_MESSAGE: 'Bootstrap failed:',
} as const;
