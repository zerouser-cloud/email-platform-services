export const S3_CLIENT = Symbol('S3_CLIENT');
export const STORAGE_HEALTH = Symbol('STORAGE_HEALTH');
export const REPORTS_STORAGE = Symbol('REPORTS_STORAGE');

export const S3_DEFAULTS = {
  FORCE_PATH_STYLE: true,
  REQUEST_CHECKSUM: 'WHEN_REQUIRED',
  RESPONSE_CHECKSUM: 'WHEN_REQUIRED',
  MAX_ATTEMPTS: 3,
} as const;

export const S3_HEALTH_CHECK = {
  DOWN_MESSAGE: 'S3 storage connection failed',
} as const;

export const S3_ENDPOINT = {
  PROTOCOL: 'http://',
  PORT_SEPARATOR: ':',
} as const;

export const S3_TIME = {
  MILLIS_PER_SECOND: 1000,
} as const;

export const S3_ERROR_NAME = {
  NOT_FOUND: 'NotFound',
} as const;
