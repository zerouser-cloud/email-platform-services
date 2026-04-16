/**
 * HttpError — non-2xx HTTP status from the remote endpoint.
 *
 * Source: refactored from Phase 24 `http-errors.ts:6-14` — now extends
 * `HttpClientError` base (D-07) and carries the `kind: 'http'` discriminator.
 */

import { HttpClientError } from './http-client.error';

export class HttpError extends HttpClientError {
  readonly kind = 'http' as const;

  constructor(
    public readonly status: number,
    public readonly url: string,
  ) {
    super(`HTTP ${status} for ${url}`, { url });
    this.name = 'HttpError';
  }
}
