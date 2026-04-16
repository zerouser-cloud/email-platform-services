/**
 * TimeoutErrorMapper — maps native timeout/abort errors to the foundation
 * `TimeoutError` (D-09 chain link 1).
 *
 * Pitfall 4: timeout errors surface under either `TimeoutError` or
 * `AbortError` name depending on Node/undici version. Both map to our
 * canonical TimeoutError.
 *
 * Source: extracted from Phase 24 `retry.policy.ts:72-77`.
 */

import type { ErrorMapper } from '../error-mapper.port';
import { TimeoutError } from '../timeout.error';
import { TIMEOUT_ERR_NAMES } from '../constants';

export class TimeoutErrorMapper implements ErrorMapper {
  matches(err: unknown): boolean {
    return err instanceof Error && (TIMEOUT_ERR_NAMES as readonly string[]).includes(err.name);
  }

  map(_err: unknown, ctx: { url: string; timeoutMs: number }): Error {
    return new TimeoutError(ctx.url, ctx.timeoutMs);
  }
}
