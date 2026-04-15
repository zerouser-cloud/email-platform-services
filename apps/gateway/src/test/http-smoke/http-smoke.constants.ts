// TODO(remove-before-release): diagnostic endpoints for HTTP client framework
// verification. Hits httpbin.org for predictable HTTP responses (status codes,
// delays). Remove this whole http-smoke/ directory + module/controller refs
// once Phase 24 is signed off and we no longer need framework smoke routes.

export const HTTP_SMOKE_CLIENT = Symbol.for('HTTP_SMOKE_CLIENT');

export const HTTP_SMOKE_TARGET_URL = 'https://httpbin.org';

export const HTTP_SMOKE_LOG_CONTEXT = 'HttpSmokeClient';

export const HTTP_SMOKE_ROUTE = 'test/http-client';

export const HTTP_SMOKE_PATH = {
  GET: '/get',
  STATUS: '/status', // append /<code>
} as const;

export const HTTP_SMOKE_DEFAULTS = {
  BURST_COUNT: 5,
  BURST_TIMEOUT_MS: 1, // 1ms guarantees AbortSignal.timeout fires before any real network roundtrip
} as const;
