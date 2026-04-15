/**
 * AppStoreSpy HTTP adapter constants (Phase 24-03).
 * D-20 DI token, no-magic-values for every literal.
 */
export const APPSTORESPY_CLIENT = Symbol.for('APPSTORESPY_CLIENT');

export const APPSTORESPY_ENV = {
  API_KEY: 'APPSTORESPY_API_KEY',
  BASE_URL: 'APPSTORESPY_BASE_URL',
} as const;

export const APPSTORESPY_LOG_CONTEXT = 'AppStoreSpyClient';

// Verified against legacy/src/parser/helpers/appstorespy.service.ts — vendor
// uses the custom `API-KEY` header, not standard Authorization.
export const APPSTORESPY_AUTH_HEADER_NAME = 'API-KEY';

export const APPSTORESPY_PATH = {
  LOOKUP_APP: '/app/lookup',
} as const;

export const APPSTORESPY_QUERY = {
  APP_ID: 'appId',
  COUNTRY: 'country',
} as const;
