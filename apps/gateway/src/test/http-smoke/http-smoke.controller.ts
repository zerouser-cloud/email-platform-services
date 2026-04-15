// TODO(remove-before-release): diagnostic endpoints exposing the HTTP client
// framework's behaviour (CB state, retry, timeout) over httpbin.org for Phase 24
// smoke verification. All routes mounted at /test/http-client/*.

import { Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { HttpSmokeClient } from './http-smoke.client';
import {
  HTTP_SMOKE_CLIENT,
  HTTP_SMOKE_DEFAULTS,
  HTTP_SMOKE_PATH,
  HTTP_SMOKE_ROUTE,
} from './http-smoke.constants';

interface CallResult {
  attempt: number;
  ok: boolean;
  ms: number;
  error?: string;
}

@Controller(HTTP_SMOKE_ROUTE)
export class HttpSmokeController {
  constructor(@Inject(HTTP_SMOKE_CLIENT) private readonly client: HttpSmokeClient) {}

  /**
   * Current CB state and consecutive-failure counter.
   * Read-only; safe to poll.
   */
  @Get('state')
  state(): { cb: 'closed' | 'halfOpen' | 'opened'; consecutiveFailures: number } {
    return this.client.getCircuitState();
  }

  /**
   * One happy-path GET against httpbin.org/get.
   * Default timeout (5s). Returns CB state before and after.
   */
  @Post('probe')
  async probe(): Promise<{
    before: ReturnType<HttpSmokeClient['getCircuitState']>;
    after: ReturnType<HttpSmokeClient['getCircuitState']>;
    outcome: { ok: boolean; ms: number; error?: string };
  }> {
    const before = this.client.getCircuitState();
    const start = Date.now();
    let outcome: { ok: boolean; ms: number; error?: string };
    try {
      await this.client.smokeGet(HTTP_SMOKE_PATH.GET);
      outcome = { ok: true, ms: Date.now() - start };
    } catch (err) {
      outcome = { ok: false, ms: Date.now() - start, error: String(err).slice(0, 200) };
    }
    const after = this.client.getCircuitState();
    return { before, after, outcome };
  }

  /**
   * Force CB open. Fires `count` GETs back-to-back with a tiny per-call
   * timeout (default 1ms) so AbortSignal.timeout always wins → every call
   * fails as TimeoutError. After 5 consecutive failures the wrapper trips
   * the breaker. Use to verify CB transitions live in dev/prod.
   */
  @Post('burst-fail')
  async burstFail(
    @Query('count') count = String(HTTP_SMOKE_DEFAULTS.BURST_COUNT),
    @Query('timeoutMs') timeoutMs = String(HTTP_SMOKE_DEFAULTS.BURST_TIMEOUT_MS),
  ): Promise<{
    config: { count: number; timeoutMs: number };
    results: CallResult[];
    finalState: ReturnType<HttpSmokeClient['getCircuitState']>;
  }> {
    const n = Number(count);
    const tMs = Number(timeoutMs);
    const results: CallResult[] = [];
    for (let i = 1; i <= n; i++) {
      const start = Date.now();
      try {
        await this.client.smokeGet(HTTP_SMOKE_PATH.GET, { timeoutMs: tMs });
        results.push({ attempt: i, ok: true, ms: Date.now() - start });
      } catch (err) {
        results.push({
          attempt: i,
          ok: false,
          ms: Date.now() - start,
          error: String(err).slice(0, 200),
        });
      }
    }
    return {
      config: { count: n, timeoutMs: tMs },
      results,
      finalState: this.client.getCircuitState(),
    };
  }

  /**
   * Single GET against httpbin.org/status/<code>. Verifies status-code-aware
   * retry policy: 5xx triggers retry, 4xx does not. Returns attempt count
   * by inspecting timing (one attempt ≈ <1s, three attempts with backoff ≈
   * 1-7s).
   */
  @Post('status')
  async status(@Query('code') code = '500'): Promise<{
    ok: boolean;
    ms: number;
    error?: string;
  }> {
    const start = Date.now();
    try {
      await this.client.smokeGet(`${HTTP_SMOKE_PATH.STATUS}/${code}`);
      return { ok: true, ms: Date.now() - start };
    } catch (err) {
      return { ok: false, ms: Date.now() - start, error: String(err).slice(0, 200) };
    }
  }
}
