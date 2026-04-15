/**
 * Retry policy + error normalisation helpers for AbstractHttpClient.
 * Internal to the http layer — NOT exported from the foundation barrel.
 */

import {
  HTTP_CLIENT_DEFAULTS,
  HTTP_CLIENT_IDEMPOTENT_METHODS,
  HTTP_CLIENT_RETRYABLE_STATUS_MIN,
  HTTP_CLIENT_TIMEOUT_ERR_NAMES,
} from './http-client.constants';
import type { HttpCallOpts, HttpMethod, RetryPolicy } from './http-client.types';
import { HttpError, NetworkError, TimeoutError } from './http-errors';

/**
 * D-09/D-10 idempotency gate: GET/HEAD + explicit `idempotent: true` get the
 * full attempt budget. Everything else is single-shot.
 *
 * No switch/case — simple array-inclusion guard (branching-patterns skill).
 */
export function resolveRetryPolicy(method: HttpMethod, opts: HttpCallOpts): RetryPolicy {
  const isIdempotent =
    HTTP_CLIENT_IDEMPOTENT_METHODS.includes(
      method as (typeof HTTP_CLIENT_IDEMPOTENT_METHODS)[number],
    ) || opts.idempotent === true;

  const maxAttempts = isIdempotent ? (opts.retries ?? HTTP_CLIENT_DEFAULTS.RETRY_MAX_ATTEMPTS) : 1;

  return {
    maxAttempts,
    backoffMinMs: HTTP_CLIENT_DEFAULTS.RETRY_BACKOFF_MIN_MS,
    backoffMaxMs: HTTP_CLIENT_DEFAULTS.RETRY_BACKOFF_MAX_MS,
    jitterRatio: HTTP_CLIENT_DEFAULTS.RETRY_JITTER_RATIO,
  };
}

/**
 * Classifier: should the next attempt run given this error + attempt index?
 *
 * Using explicit `instanceof` guards (not a Record-dispatch) — this is a
 * 4-branch type classification, not a 3-branch behaviour switch.
 */
export function shouldRetry(err: unknown, attempt: number, policy: RetryPolicy): boolean {
  if (attempt >= policy.maxAttempts) return false;
  if (err instanceof HttpError) return err.status >= HTTP_CLIENT_RETRYABLE_STATUS_MIN;
  if (err instanceof NetworkError) return true;
  if (err instanceof TimeoutError) return true;
  return false;
}

/**
 * Equal-jitter backoff (AWS Architecture Blog). Reduces thundering-herd when
 * many clients recover simultaneously (Pitfall 8).
 *
 * delay = clamp(backoffMinMs * 2^(attempt-1), backoffMinMs, backoffMaxMs)
 * return delay/2 + random(0, delay/2)
 */
export function backoffWithJitter(attempt: number, policy: RetryPolicy): number {
  const exp = policy.backoffMinMs * Math.pow(2, attempt - 1);
  const delay = Math.max(policy.backoffMinMs, Math.min(exp, policy.backoffMaxMs));
  return delay / 2 + Math.random() * (delay / 2);
}

/**
 * Map fetch-raised errors to the foundation error hierarchy.
 *
 * Pitfall 4: both 'TimeoutError' and 'AbortError' names must normalise to our
 * canonical TimeoutError (name varies by Node / undici version).
 * Pitfall 7: `fetch` network errors surface as `TypeError` with a `cause`.
 */
export function normalizeError(err: unknown, url: string, timeoutMs: number): Error {
  if (
    err instanceof Error &&
    (HTTP_CLIENT_TIMEOUT_ERR_NAMES as readonly string[]).includes(err.name)
  ) {
    return new TimeoutError(url, timeoutMs);
  }
  if (err instanceof TypeError && 'cause' in err) {
    return new NetworkError(url, (err as TypeError & { cause: unknown }).cause);
  }
  return err instanceof Error ? err : new Error(String(err));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
