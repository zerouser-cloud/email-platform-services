/**
 * NetworkError — fetch-layer failure (DNS, connection refused, TLS, etc.).
 *
 * Source: refactored from Phase 24 `http-errors.ts:26-34` — extends
 * `HttpClientError` base (D-07) with `kind: 'network'` discriminator and
 * uses native ES2022 `ErrorOptions.cause` via `super(msg, ctx, { cause })`
 * (D-08). The old ad-hoc `public readonly cause` field is REMOVED —
 * consumers read `err.cause` via the native `Error` getter.
 */

import { HttpClientError } from './http-client.error';

export class NetworkError extends HttpClientError {
  readonly kind = 'network' as const;

  constructor(
    public readonly url: string,
    cause: unknown,
  ) {
    super(`Network error for ${url}`, { url }, { cause });
    this.name = 'NetworkError';
  }
}
