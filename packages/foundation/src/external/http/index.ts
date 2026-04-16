/**
 * Public barrel for the foundation HTTP client layer (Phase 24.1 D-16/D-17).
 *
 * Exports only consumer-facing symbols. Internal helpers (request-executor,
 * default-retry-executor, opossum-circuit-breaker.adapter, pino-http-client-
 * logger.adapter, HttpErrorNormalizer, internal constants, DI tokens) are
 * intentionally NOT exported — they are implementation details that live
 * behind `httpClientProvider`.
 */

// =====================================================================
// CONSUMER-FACING PUBLIC API (D-16)
// =====================================================================

// Client (abstract base + types)
export { AbstractHttpClient } from './client/abstract-http.client';
export type { HttpClientDeps } from './client/http-client-deps';
export type {
  HttpCallOpts,
  HttpMethod,
  CbOptions,
  RetryPolicy,
  CircuitState,
} from './client/types';
export { HTTP_CLIENT_LOG } from './client/constants';
export { HTTP_CLIENT_HEADERS } from './client/request.constants';

// Provider factory (DX)
export { httpClientProvider } from './provider/http-client.provider';
export type { HttpClientProviderOpts } from './provider/http-client.provider';

// Errors (consumer-facing — instanceof discrimination)
export { HttpClientError } from './errors/http-client.error';
export type { HttpClientErrorKind } from './errors/http-client.error';
export { HttpError } from './errors/http-error';
export { TimeoutError } from './errors/timeout.error';
export { NetworkError } from './errors/network.error';
export { CircuitOpenError } from './errors/circuit-open.error';

// Port types (for custom adapters or advanced consumers)
export type { RetryExecutorPort } from './retry/retry-executor.port';
export type { CircuitBreakerPort } from './circuit-breaker/circuit-breaker.port';
export type { HttpClientLogger } from './logger/http-client-logger.port';
export type { HttpClientLogFields, CircuitTransitionLogFields } from './logger/types';

// Defaults (for per-vendor overrides via httpClientProvider opts)
export { RETRY_DEFAULTS } from './retry/constants';
export { CB_DEFAULTS } from './circuit-breaker/constants';

// =====================================================================
// INTENTIONALLY NOT EXPORTED (D-17, internal implementation details)
// =====================================================================
// - IDEMPOTENT_METHODS, RETRYABLE_STATUS_MIN              (retry/constants.ts)
// - TIMEOUT_ERR_NAMES                                     (errors/constants.ts)
// - CB_BREAKER_OPEN_MESSAGE_SUBSTRING                     (circuit-breaker/constants.ts)
// - HttpRequestExecutor, DefaultRetryExecutor,            (collaborators — wired inside provider)
//   OpossumCircuitBreakerAdapter, PinoHttpClientLoggerAdapter
// - HttpErrorNormalizer, ErrorMapper, concrete mappers    (error normaliser chain)
// - HTTP_REQUEST_EXECUTOR, RETRY_EXECUTOR, HTTP_CLIENT_LOGGER (DI tokens — consumed by provider)

// =====================================================================
// TEMPORARY COMPAT BRIDGE — REMOVE AT END OF PLAN 03 (D-22 migration)
// =====================================================================
// Per-vendor modules (telegram/appstorespy/cloudfn/http-smoke) currently
// import HTTP_CLIENT_DEFAULTS as a flat object. Plan 03 migrates them to
// httpClientProvider and removes this bridge. Composing RETRY_DEFAULTS +
// CB_DEFAULTS + TIMEOUT_MS here keeps Plan 02 pnpm build/typecheck green
// across the Plan 02 → Plan 03 window.
import { RETRY_DEFAULTS as _RETRY } from './retry/constants';
import { CB_DEFAULTS as _CB } from './circuit-breaker/constants';
export const HTTP_CLIENT_DEFAULTS = {
  TIMEOUT_MS: 5_000,
  ..._RETRY,
  ..._CB,
} as const;
