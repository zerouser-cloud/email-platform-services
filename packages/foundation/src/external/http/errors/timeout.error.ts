/**
 * TimeoutError — per-attempt timeout (AbortSignal.timeout fired).
 *
 * Source: refactored from Phase 24 `http-errors.ts:16-24` — extends
 * `HttpClientError` base (D-07) with `kind: 'timeout'` discriminator.
 */

import { HttpClientError } from './http-client.error';

export class TimeoutError extends HttpClientError {
  readonly kind = 'timeout' as const;

  constructor(
    public readonly url: string,
    public readonly timeoutMs: number,
  ) {
    super(`Timed out after ${timeoutMs}ms for ${url}`, { url });
    this.name = 'TimeoutError';
  }
}
