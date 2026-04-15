/**
 * Public barrel for the foundation HTTP client layer.
 *
 * Exports only consumer-facing symbols. Internal helpers (retry.policy,
 * circuit-breaker.factory) are intentionally NOT exported — they are
 * implementation details of AbstractHttpClient.
 */

export { AbstractHttpClient } from './abstract-http.client';
export {
  HTTP_CLIENT_DEFAULTS,
  HTTP_CLIENT_IDEMPOTENT_METHODS,
  HTTP_CLIENT_LOG,
} from './http-client.constants';
export type {
  CbOptions,
  CircuitTransitionLogFields,
  HttpCallOpts,
  HttpClientLogFields,
  HttpMethod,
  RetryPolicy,
} from './http-client.types';
export {
  CircuitOpenError,
  ConsecutiveThresholdError,
  HttpError,
  NetworkError,
  TimeoutError,
} from './http-errors';
