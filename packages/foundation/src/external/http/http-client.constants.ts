/**
 * Constants for the generic HTTP client primitives under `external/http/`.
 *
 * All values live here (no magic values elsewhere in the HTTP layer) per
 * `.agents/skills/no-magic-values/SKILL.md`. Decisions D-09..D-17 traced inline.
 */

export const HTTP_CLIENT_LOG = {
  EVENT_CALL: 'http.client.call',
  EVENT_CB_TRANSITION: 'http.client.circuit',
  STATUS_OK: 'OK',
  STATUS_ERROR: 'ERROR',
  CB_OPEN: 'open',
  CB_HALF_OPEN: 'halfOpen',
  CB_CLOSE: 'close',
} as const;

export const HTTP_CLIENT_DEFAULTS = {
  // D-11: 5s per-attempt timeout via AbortSignal.timeout
  TIMEOUT_MS: 5_000,
  // D-09: up to 3 attempts for retryable methods (GET/HEAD by default)
  RETRY_MAX_ATTEMPTS: 3,
  RETRY_BACKOFF_MIN_MS: 200,
  RETRY_BACKOFF_MAX_MS: 5_000,
  RETRY_JITTER_RATIO: 0.5,
  // D-12: breaker opens after 5 consecutive failures, half-opens after 30s
  CB_CONSECUTIVE_THRESHOLD: 5,
  CB_HALF_OPEN_AFTER_MS: 30_000,
  // Option B sentinel: wrapper emits a single ConsecutiveThresholdError,
  // opossum treats every volume-threshold-met failure as a 100% error rate
  // and opens the circuit on that one sentinel.
  CB_ERROR_PERCENT: 100,
  CB_VOLUME_THRESHOLD: 1,
} as const;

// D-10: GET/HEAD are idempotent by default. Other methods must opt-in via
// `HttpCallOpts.idempotent = true` to be retried.
export const HTTP_CLIENT_IDEMPOTENT_METHODS = ['GET', 'HEAD'] as const;

// D-09: 5xx retried, 4xx never retried.
export const HTTP_CLIENT_RETRYABLE_STATUS_MIN = 500;

// Pitfall 4: timeout errors surface under either name depending on the Node
// version / runtime. Both are mapped to our canonical TimeoutError.
export const HTTP_CLIENT_TIMEOUT_ERR_NAMES = ['TimeoutError', 'AbortError'] as const;

// Pitfall 5 fallback: primary open-state detection uses `breaker.opened`.
// This substring is only the secondary recognition path when the error
// originates from opossum's reject.
export const HTTP_CLIENT_CB_BREAKER_OPEN_MESSAGE_SUBSTRING = 'Breaker is open';
