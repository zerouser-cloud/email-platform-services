/**
 * Public type surface for the foundation HTTP client.
 *
 * Kept intentionally generic — adapters in apps supply their own per-API
 * extensions. No per-API (Telegram / AppStoreSpy / CloudFn) knowledge here.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';

/**
 * Per-call options for HTTP requests. Named `HttpCallOpts` (not `CallOpts`)
 * to avoid collision with the gRPC `CallOpts` that is already re-exported
 * from the foundation barrel via `external/grpc/clients`.
 */
export interface HttpCallOpts {
  readonly timeoutMs?: number;
  /** D-10: opt-in retry flag for non-idempotent methods (POST/PUT/PATCH/DELETE). */
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

export interface HttpClientLogFields {
  readonly api: string;
  readonly method: HttpMethod;
  readonly url: string;
  readonly duration_ms: number;
  readonly status_code: number | undefined;
  readonly status: 'OK' | 'ERROR';
  readonly correlationId: string | undefined;
}

export interface CircuitTransitionLogFields {
  readonly api: string;
  readonly transition: 'open' | 'halfOpen' | 'close';
}
