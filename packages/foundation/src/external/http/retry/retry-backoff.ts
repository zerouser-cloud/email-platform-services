/**
 * Equal-jitter backoff (AWS Architecture Blog). Reduces thundering-herd when
 * many clients recover simultaneously.
 *
 * delay = clamp(backoffMinMs * 2^(attempt-1), backoffMinMs, backoffMaxMs)
 * return delay/2 + random(0, delay/2)
 *
 * Source: lifted verbatim from Phase 24 `retry.policy.ts:58-62`. Pure math,
 * no imports from retry/ constants.
 */

import type { RetryPolicy } from '../client/types';

export function backoffWithJitter(attempt: number, policy: RetryPolicy): number {
  const exp = policy.backoffMinMs * Math.pow(2, attempt - 1);
  const delay = Math.max(policy.backoffMinMs, Math.min(exp, policy.backoffMaxMs));
  return delay / 2 + Math.random() * (delay / 2);
}
