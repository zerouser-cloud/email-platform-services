/**
 * Idempotency gate: GET/HEAD + explicit `idempotent: true` get the full
 * attempt budget. Everything else is single-shot.
 *
 * No switch/case — simple array-inclusion guard (branching-patterns skill).
 *
 * Source: lifted from Phase 24 `retry.policy.ts:21-35`. Imports repointed to
 * `retry/constants.ts` (new module layout).
 */

import type { HttpCallOpts, HttpMethod, RetryPolicy } from '../client/types';
import { IDEMPOTENT_METHODS, RETRY_DEFAULTS } from './constants';

export function resolveRetryPolicy(method: HttpMethod, opts: HttpCallOpts): RetryPolicy {
  const isIdempotent =
    IDEMPOTENT_METHODS.includes(method as (typeof IDEMPOTENT_METHODS)[number]) ||
    opts.idempotent === true;

  const maxAttempts = isIdempotent ? (opts.retries ?? RETRY_DEFAULTS.RETRY_MAX_ATTEMPTS) : 1;

  return {
    maxAttempts,
    backoffMinMs: RETRY_DEFAULTS.RETRY_BACKOFF_MIN_MS,
    backoffMaxMs: RETRY_DEFAULTS.RETRY_BACKOFF_MAX_MS,
    jitterRatio: RETRY_DEFAULTS.RETRY_JITTER_RATIO,
  };
}
