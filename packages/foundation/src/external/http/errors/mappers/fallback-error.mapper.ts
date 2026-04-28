/**
 * FallbackErrorMapper — wraps non-Error throwables in a plain `Error`
 * (D-09 chain link 3).
 *
 * Matches anything that is NOT an instance of `Error`. Placed at the END of
 * the normalizer chain so the preceding mappers get first shot at typed
 * runtime errors; only exotic throwables (strings, numbers, plain objects)
 * fall through to this adapter.
 *
 * Source: extracted from Phase 24 `retry.policy.ts:81` (`err instanceof Error
 * ? err : new Error(String(err))` tail).
 */

import type { ErrorMapper } from '../error-mapper.port';

export class FallbackErrorMapper implements ErrorMapper {
  matches(err: unknown): boolean {
    return !(err instanceof Error);
  }

  map(err: unknown): Error {
    return new Error(String(err));
  }
}
