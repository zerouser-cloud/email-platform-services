/**
 * RetryExecutorPort — port for retry orchestration (D-03).
 *
 * Separates the retry loop from `AbstractHttpClient`. The default adapter
 * (`DefaultRetryExecutor`, added in Task 2) wraps `shouldRetry` +
 * `backoffWithJitter` + `sleep`. Custom adapters can implement alternative
 * strategies (budget-based, bulkhead-aware, etc.).
 */

import type { HttpCallOpts, HttpMethod, RetryPolicy } from '../client/types';

export interface RetryExecutorPort {
  resolvePolicy(method: HttpMethod, opts: HttpCallOpts): RetryPolicy;
  run<T>(attempt: () => Promise<T>, policy: RetryPolicy): Promise<T>;
}
