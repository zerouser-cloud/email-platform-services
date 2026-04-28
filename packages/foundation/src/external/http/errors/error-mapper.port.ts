/**
 * ErrorMapper — port for the chain-of-mappers normalizer (D-09).
 *
 * Each adapter implementation (timeout / network / fallback) declares whether
 * it `matches(err)` a given raw error, and if so, maps it to a foundation
 * Error class via `map(err, ctx)`. `HttpErrorNormalizer` (Task 2) iterates
 * a mapper array until `matches` returns true — adding a new error type is
 * a single new mapper, no if/else edits.
 *
 * Replacement for the imperative `normalizeError` function at Phase 24
 * `retry.policy.ts:71-82`.
 */

export interface ErrorMapper {
  matches(err: unknown): boolean;
  map(err: unknown, ctx: { url: string; timeoutMs: number }): Error;
}
