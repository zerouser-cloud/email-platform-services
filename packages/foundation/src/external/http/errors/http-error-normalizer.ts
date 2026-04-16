/**
 * HttpErrorNormalizer — chain-of-mappers error normaliser (D-09).
 *
 * Replaces the imperative `normalizeError` function from Phase 24
 * `retry.policy.ts:71-82`. Adding a new error type is now a single additional
 * `ErrorMapper` in the chain — no if/else edits.
 *
 * Execution contract: iterate mappers in declaration order, return the first
 * successful `map()`. If no mapper matches and the throwable is an `Error`,
 * return it unchanged; otherwise wrap in a plain `Error`. This last-ditch
 * path is duplicated by `FallbackErrorMapper` intentionally — the class is
 * safe even if the caller forgets to include the fallback mapper in the
 * chain.
 */

import type { ErrorMapper } from './error-mapper.port';

export class HttpErrorNormalizer {
  constructor(private readonly mappers: readonly ErrorMapper[]) {}

  normalize(err: unknown, ctx: { url: string; timeoutMs: number }): Error {
    const mapper = this.mappers.find((m) => m.matches(err));
    if (!mapper) return err instanceof Error ? err : new Error(String(err));
    return mapper.map(err, ctx);
  }
}
