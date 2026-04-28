/**
 * Error-concern constants. INTERNAL (D-17) — do NOT re-export from the
 * foundation barrel.
 *
 * Source: lifted from Phase 24 `http-client.constants.ts:42`. Drops
 * `HTTP_CLIENT_` prefix per Pattern S9.
 *
 * Pitfall 4: timeout errors surface under either name depending on the Node
 * version / runtime. Both are mapped to our canonical TimeoutError via the
 * `TimeoutErrorMapper` (Task 2).
 */

export const TIMEOUT_ERR_NAMES = ['TimeoutError', 'AbortError'] as const;
