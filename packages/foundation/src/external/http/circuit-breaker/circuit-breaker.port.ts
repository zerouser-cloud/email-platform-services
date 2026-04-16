/**
 * CircuitBreakerPort — port for the circuit-breaker primitive (D-04).
 *
 * Encapsulates opossum (or any other backing CB library) behind a minimal
 * interface. `fire(...args)` invokes the wrapped function under the breaker;
 * `state` exposes the diagnostic snapshot (D-35); `dispose()` detaches
 * listeners and shuts the breaker down — critical for deterministic test
 * teardown.
 *
 * Generic parameters (`TArgs`, `TReturn`) default to the most permissive
 * shape; the HTTP orchestrator (Plan 02) narrows to
 * `CircuitBreakerPort<[() => Promise<Response>], Response>` — the retry loop
 * is passed in as the first argument at fire time.
 */

import type { CircuitState } from '../client/types';

export interface CircuitBreakerPort<TArgs extends unknown[] = unknown[], TReturn = unknown> {
  fire(...args: TArgs): Promise<TReturn>;
  get state(): CircuitState;
  dispose(): void;
}
