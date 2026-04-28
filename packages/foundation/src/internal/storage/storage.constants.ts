export const S3_CLIENT = Symbol('S3_CLIENT');

// Canonical Config Access Contract (Phase 999.11.1 D-10) — narrow config port.
// App-owned useFactory projects {SVC}_CONFIG into StorageCoreConfig shape.
export const STORAGE_CORE_CONFIG_PORT = Symbol('STORAGE_CORE_CONFIG_PORT');

export const S3_DEFAULTS = {
  FORCE_PATH_STYLE: true,
  REQUEST_CHECKSUM: 'WHEN_REQUIRED' as const,
  RESPONSE_CHECKSUM: 'WHEN_REQUIRED' as const,
  MAX_ATTEMPTS: 3,
} as const;

export const STORAGE_ENDPOINT_SEPARATOR = {
  SCHEME: '://',
  PORT: ':',
} as const;

export const S3_HEALTH_CHECK = {
  DOWN_MESSAGE: 'S3 storage connection failed',
} as const;

export const S3_TIME = {
  MILLIS_PER_SECOND: 1000,
} as const;

export const S3_ERROR_NAME = {
  NOT_FOUND: 'NotFound',
} as const;
