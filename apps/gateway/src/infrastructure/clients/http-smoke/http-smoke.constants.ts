/**
 * HttpSmokeClient creation-time constants (D-24).
 *
 * Only the three symbols needed to construct the client via `httpClientProvider`
 * live here: the DI token, the literal target base URL, and the log context.
 * Route-level constants (routes, path builders, controller defaults) stay in
 * `apps/gateway/src/test/http-smoke/http-smoke.constants.ts` under the
 * TODO(remove-before-release) fence (D-25).
 */

export const HTTP_SMOKE_CLIENT = Symbol.for('HTTP_SMOKE_CLIENT');

export const HTTP_SMOKE_TARGET_URL = 'https://httpbin.org';

export const HTTP_SMOKE_LOG_CONTEXT = 'HttpSmokeClient';
