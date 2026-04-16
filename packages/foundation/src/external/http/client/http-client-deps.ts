/**
 * HttpClientDeps — param-bag type for AbstractHttpClient (D-01).
 *
 * Replaces the 5-arg positional constructor of Phase 24. All fields are
 * `readonly` per Pattern S6 (analog: `NamespaceOptions` in
 * `external/storage/public/namespaced-storage.interface.ts`).
 *
 * Constructed by `httpClientProvider` (Plan 02) — foundation resolves the
 * shared collaborators (logger, executor, retry, breaker) and hands the
 * param-bag to each vendor adapter's constructor.
 *
 * Note: `HttpRequestExecutor` is a type-only forward import. The class file
 * is created in Task 2 (request-executor.ts). TypeScript `import type` does
 * not require the value at module-graph construction time, only at emit.
 */

import type { ClsService } from 'nestjs-cls';
import type { CircuitBreakerPort } from '../circuit-breaker/circuit-breaker.port';
import type { HttpClientLogger } from '../logger/http-client-logger.port';
import type { RetryExecutorPort } from '../retry/retry-executor.port';
import type { HttpRequestExecutor } from './request-executor';

export interface HttpClientDeps {
  readonly cls: ClsService;
  readonly logger: HttpClientLogger;
  readonly executor: HttpRequestExecutor;
  readonly retry: RetryExecutorPort;
  readonly breaker: CircuitBreakerPort<[() => Promise<Response>], Response>;
  readonly baseUrl: string;
  readonly defaultTimeoutMs: number;
  readonly logContext: string;
}
