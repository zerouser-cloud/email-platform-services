export const GRPC_CLIENT_LOG = {
  EVENT: 'grpc.client.call',
  STATUS_OK: 'OK',
  STATUS_ERROR: 'ERROR',
} as const;

export const GRPC_CLIENT_DEADLINE = {
  METADATA_HEADER: 'grpc-timeout',
  METADATA_UNIT_MILLISECONDS: 'm',
} as const;

export const GRPC_CLIENT_HEALTH = {
  SERVICE_NAME: 'Health',
  PACKAGE: 'grpc.health.v1',
  STATUS_SERVING: 1,
  DOWN_MESSAGE: 'grpc health unreachable',
  OVERALL_SERVICE_KEY: '',
} as const;
