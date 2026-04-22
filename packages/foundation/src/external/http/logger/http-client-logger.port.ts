/**
 * HttpClientLogger — domain-specific logger port (D-05).
 *
 * Two typed events: `call()` for request/response outcomes and `transition()`
 * for circuit-breaker state changes. Level choice (info vs error/warn) lives
 * inside the adapter implementation (see `PinoHttpClientLoggerAdapter` in
 * Task 2) — AbstractHttpClient does NOT decide log levels (D-05).
 *
 * Intentionally domain-specific (not a generic `ILogger`) — the narrow surface
 * keeps vendor/format concerns off the orchestrator hot path. D-06:
 * port shape is compatible with a future application-wide logging migration
 * (likely OTEL-based) — consumers will re-bind the adapter, not the port.
 */

import type { CircuitTransitionLogFields, HttpClientLogFields } from './types';

export interface HttpClientLogger {
  call(fields: HttpClientLogFields): void;
  transition(fields: CircuitTransitionLogFields): void;
}
