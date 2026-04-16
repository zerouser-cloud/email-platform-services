/**
 * HTTP-client log field shapes.
 *
 * Source: moved from Phase 24 `http-client.types.ts:35-48`. Stays typed here
 * so alternative logger adapters (e.g. OpenTelemetry) can consume the same
 * structured shape without importing Pino-specific types.
 */

import type { HttpMethod } from '../client/types';

export interface HttpClientLogFields {
  readonly api: string;
  readonly method: HttpMethod;
  readonly url: string;
  readonly duration_ms: number;
  readonly status_code: number | undefined;
  readonly status: 'OK' | 'ERROR';
  readonly correlationId: string | undefined;
}

export interface CircuitTransitionLogFields {
  readonly api: string;
  readonly transition: 'open' | 'halfOpen' | 'close';
}
