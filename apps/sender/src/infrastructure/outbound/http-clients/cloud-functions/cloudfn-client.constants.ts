/**
 * Cloud Functions HTTP adapter constants (Phase 24-03).
 * D-20 DI token, no-magic-values literals.
 */
export const CLOUDFN_CLIENT = Symbol.for('CLOUDFN_CLIENT');

export const CLOUDFN_ENV = {
  API_KEY: 'CLOUDFN_API_KEY',
  BASE_URL: 'CLOUDFN_BASE_URL',
} as const;

export const CLOUDFN_LOG_CONTEXT = 'CloudFnClient';

// Google Cloud Functions use standard Bearer auth.
export const CLOUDFN_AUTH_HEADER_NAME = 'Authorization';
export const CLOUDFN_AUTH_HEADER_VALUE_PREFIX = 'Bearer ';

export const CLOUDFN_PATH = {
  SEND_EMAIL: '/sendEmail',
} as const;
