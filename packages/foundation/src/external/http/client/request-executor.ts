/**
 * HttpRequestExecutor — stateless executor of a single HTTP attempt (D-02).
 *
 * Responsibilities (each a private helper, no branching chains):
 *   1. Compose the final `RequestInit` (timeout signal, merged headers).
 *   2. Invoke `fetch`.
 *   3. Reject on `!res.ok` with `HttpError` + emit structured error log.
 *   4. Normalise any other thrown error through `HttpErrorNormalizer`.
 *   5. Emit a structured success log on 2xx.
 *
 * Does NOT know about retry or circuit breaker — those wrap this via
 * `RetryExecutorPort.run` and `CircuitBreakerPort.fire` in Plan 02.
 *
 * Source: extracted from Phase 24 `abstract-http.client.ts:160-196`
 * (`executeAttempt` body).
 */

import { Injectable } from '@nestjs/common';
import { HTTP_CLIENT_LOG } from './constants';
import type { HttpCallOpts, HttpMethod } from './types';
import { HttpClientError } from '../errors/http-client.error';
import { HttpError } from '../errors/http-error';
import type { HttpErrorNormalizer } from '../errors/http-error-normalizer';
import type { HttpClientLogger } from '../logger/http-client-logger.port';

@Injectable()
export class HttpRequestExecutor {
  constructor(
    private readonly normalizer: HttpErrorNormalizer,
    private readonly logger: HttpClientLogger,
  ) {}

  async execute(
    method: HttpMethod,
    path: string,
    init: RequestInit,
    opts: HttpCallOpts,
    baseUrl: string,
    authHeaders: Record<string, string>,
    defaultTimeoutMs: number,
    logContext: string,
  ): Promise<Response> {
    const start = Date.now();
    const url = `${baseUrl}${path}`;
    const timeoutMs = opts.timeoutMs ?? defaultTimeoutMs;
    const signal = AbortSignal.timeout(timeoutMs);
    const headers = this.mergeHeaders(authHeaders, init, opts);
    const finalInit: RequestInit = { ...init, method, signal, headers };

    try {
      const res = await fetch(url, finalInit);
      const duration = Date.now() - start;
      const status = res.ok ? HTTP_CLIENT_LOG.STATUS_OK : HTTP_CLIENT_LOG.STATUS_ERROR;
      this.logger.call({
        api: logContext,
        method,
        url,
        duration_ms: duration,
        status_code: res.status,
        status,
        correlationId: undefined,
      });
      if (!res.ok) throw new HttpError(res.status, url);
      return res;
    } catch (err) {
      // Pitfall 6: fetch does NOT throw on 4xx/5xx — the HttpError thrown
      // above re-enters this catch. Pass through unchanged; mappers do not
      // match HttpClientError instances.
      if (err instanceof HttpClientError) throw err;
      const normalized = this.normalizer.normalize(err, { url, timeoutMs });
      const duration = Date.now() - start;
      this.logger.call({
        api: logContext,
        method,
        url,
        duration_ms: duration,
        status_code: undefined,
        status: HTTP_CLIENT_LOG.STATUS_ERROR,
        correlationId: undefined,
      });
      throw normalized;
    }
  }

  private mergeHeaders(
    authHeaders: Record<string, string>,
    init: RequestInit,
    opts: HttpCallOpts,
  ): Record<string, string> {
    return {
      ...authHeaders,
      ...((init.headers as Record<string, string> | undefined) ?? {}),
      ...(opts.headers ?? {}),
    };
  }
}
