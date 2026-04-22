/**
 * Retry-concern constants (Phase 24.1 D-14 split).
 *
 * `RETRY_DEFAULTS` is re-exported from the foundation barrel (consumer-facing,
 * used by `httpClientProvider` in Plan 02). `IDEMPOTENT_METHODS` and
 * `RETRYABLE_STATUS_MIN` are internal to the retry module (D-17).
 *
 * Source: split from Phase 24 `http-client.constants.ts:18-38`. Drops the
 * `HTTP_CLIENT_` prefix per Pattern S9 (redundant inside `retry/`).
 */

export const RETRY_DEFAULTS = {
  RETRY_MAX_ATTEMPTS: 3,
  RETRY_BACKOFF_MIN_MS: 200,
  RETRY_BACKOFF_MAX_MS: 5_000,
  RETRY_JITTER_RATIO: 0.5,
} as const;

// INTERNAL (D-17) — do NOT re-export from the foundation barrel.
// GET/HEAD are idempotent by default. Other methods must opt-in via
// `HttpCallOpts.idempotent = true` to be retried.
export const IDEMPOTENT_METHODS = ['GET', 'HEAD'] as const;

// INTERNAL (D-17) — do NOT re-export. 5xx retried, 4xx never retried.
export const RETRYABLE_STATUS_MIN = 500;
