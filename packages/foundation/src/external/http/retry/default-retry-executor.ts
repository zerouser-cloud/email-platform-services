/**
 * DefaultRetryExecutor — default `RetryExecutorPort` implementation (D-03).
 *
 * Source: extracted from Phase 24 `abstract-http.client.ts:140-158`
 * (`executeWithRetry` body) + `retry.policy.ts` helpers. `shouldRetry` +
 * `backoffWithJitter` + `sleep` now live in their own files under `retry/`;
 * this adapter composes them.
 */

import type { HttpCallOpts, HttpMethod, RetryPolicy } from '../client/types';
import { backoffWithJitter } from './retry-backoff';
import type { RetryExecutorPort } from './retry-executor.port';
import { resolveRetryPolicy } from './retry-policy.resolver';
import { shouldRetry } from './retry-policy.classifier';
import { sleep } from './sleep';

export class DefaultRetryExecutor implements RetryExecutorPort {
  resolvePolicy(method: HttpMethod, opts: HttpCallOpts): RetryPolicy {
    return resolveRetryPolicy(method, opts);
  }

  async run<T>(attempt: () => Promise<T>, policy: RetryPolicy): Promise<T> {
    let lastErr: unknown;
    for (let i = 1; i <= policy.maxAttempts; i++) {
      try {
        return await attempt();
      } catch (err) {
        lastErr = err;
        if (!shouldRetry(err, i, policy)) throw err;
        await sleep(backoffWithJitter(i, policy));
      }
    }
    throw lastErr;
  }
}
