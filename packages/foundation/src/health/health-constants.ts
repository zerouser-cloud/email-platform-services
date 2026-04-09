export const HEALTH = {
  ROUTE: 'health',
  LIVE: 'live',
  READY: 'ready',
  CHECK_TIMEOUT: 3000,
  HEAP_LIMIT: 512 * 1024 * 1024,
  STUB_MESSAGE: 'stub — no connection configured',
  GRPC_SERVICE_OVERALL: '',
  GRPC_STATUS_SERVING: 'SERVING',
  INDICATOR: {
    MEMORY_HEAP: 'memory_heap',
    REDIS: 'redis',
    RABBITMQ: 'rabbitmq',
    POSTGRESQL: 'postgresql',
    S3: 's3',
  },
} as const;
