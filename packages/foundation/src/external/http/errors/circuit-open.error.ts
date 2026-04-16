/**
 * CircuitOpenError — thrown by `OpossumCircuitBreakerAdapter.fire()` when the
 * breaker rejects without invoking the inner function (opened or half-open
 * probe failed).
 *
 * Source: refactored from Phase 24 `http-errors.ts:36-41` — extends
 * `HttpClientError` base (D-07) with `kind: 'circuit-open'` discriminator.
 */

import { HttpClientError } from './http-client.error';

export class CircuitOpenError extends HttpClientError {
  readonly kind = 'circuit-open' as const;

  constructor(public readonly api: string) {
    super(`Circuit open for ${api}`, { api });
    this.name = 'CircuitOpenError';
  }
}
