/**
 * Circuit-breaker concern constants (Phase 24.1 D-14 split).
 *
 * `CB_DEFAULTS` is re-exported from the foundation barrel (consumer-facing,
 * used by `httpClientProvider` in Plan 02). `CB_BREAKER_OPEN_MESSAGE_SUBSTRING`
 * is INTERNAL (D-13/D-17) — a private detail of `OpossumCircuitBreakerAdapter`.
 *
 * Source: split from Phase 24 `http-client.constants.ts:26-47`. Drops the
 * `HTTP_CLIENT_` prefix per Pattern S9.
 */

export const CB_DEFAULTS = {
  CB_CONSECUTIVE_THRESHOLD: 5,
  CB_HALF_OPEN_AFTER_MS: 30_000,
} as const;

// INTERNAL (D-13/D-17) — private detail of OpossumCircuitBreakerAdapter.
// Do NOT re-export from the foundation barrel.
//
// Pitfall 5 fallback: primary open-state detection uses `breaker.opened`.
// This substring is only the secondary recognition path when the error
// originates from opossum's reject.
export const CB_BREAKER_OPEN_MESSAGE_SUBSTRING = 'Breaker is open';
