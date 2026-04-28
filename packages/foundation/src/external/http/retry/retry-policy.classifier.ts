/**
 * Classifier: should the next attempt run given this error + attempt index?
 *
 * Using explicit `instanceof` guards (not a Record-dispatch) — this is a
 * 4-branch type classification, not a 3-branch behaviour switch (D-11).
 *
 * Source: lifted from Phase 24 `retry.policy.ts:43-49`. Imports repointed to
 * the new `errors/` modules.
 */

import type { RetryPolicy } from '../client/types';
import { HttpError } from '../errors/http-error';
import { NetworkError } from '../errors/network.error';
import { TimeoutError } from '../errors/timeout.error';
import { RETRYABLE_STATUS_MIN } from './constants';

export function shouldRetry(err: unknown, attempt: number, policy: RetryPolicy): boolean {
  if (attempt >= policy.maxAttempts) return false;
  // D-11: instanceof chain stays — 4-branch type classification, NOT behavioural switch.
  if (err instanceof HttpError) return err.status >= RETRYABLE_STATUS_MIN;
  if (err instanceof NetworkError) return true;
  if (err instanceof TimeoutError) return true;
  return false;
}
