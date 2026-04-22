/**
 * Shared type surface for the foundation HTTP client layer.
 *
 * Kept intentionally generic — adapters in apps supply their own per-API
 * extensions. No per-API (Telegram / AppStoreSpy / CloudFn) knowledge here.
 *
 * Phase 24.1: `HttpClientLogFields` / `CircuitTransitionLogFields` moved to
 * `logger/types.ts` (logger-concern). `CircuitState` added (D-35) — single
 * source of truth for the previously 4x-duplicated inline type.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';

/**
 * Per-call options for HTTP requests. Named `HttpCallOpts` (not `CallOpts`)
 * to avoid collision with the gRPC `CallOpts` re-exported from the foundation
 * barrel via `external/grpc/clients`.
 */
export interface HttpCallOpts {
  readonly timeoutMs?: number;
  /** Opt-in retry flag for non-idempotent methods (POST/PUT/PATCH/DELETE). */
  readonly idempotent?: boolean;
  readonly retries?: number;
  readonly headers?: Record<string, string>;
}

export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly backoffMinMs: number;
  readonly backoffMaxMs: number;
  readonly jitterRatio: number;
}

export interface CbOptions {
  readonly consecutiveThreshold: number;
  readonly halfOpenAfterMs: number;
}

/**
 * D-35: single source of truth for the circuit-breaker state snapshot.
 * Previously duplicated as an inline type at:
 *   - abstract-http.client.ts (Phase 24)
 *   - http-smoke.client.ts
 *   - http-smoke.controller.ts (returns from getCircuitState)
 */
export interface CircuitState {
  readonly cb: 'closed' | 'halfOpen' | 'opened';
  readonly consecutiveFailures: number;
}
