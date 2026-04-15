/**
 * AbstractHttpClient — foundation-level base class for outbound HTTP adapters.
 *
 * Design mirrors `packages/foundation/src/external/grpc/clients/abstract-grpc-client.ts`
 * verbatim where semantics overlap (Pitfall 2 / Phase 23 Pitfall 6):
 *   • PinoLogger.root.child({ context }) created in onModuleInit, NOT constructor
 *     — root is undefined at construction time (LoggerModule not yet booted).
 *   • No @Inject(PinoLogger) + setContext(): that mutates the shared singleton,
 *     the last-initialised subclass overwrites every sibling's context.
 *
 * Execution stack (outer to inner):
 *   caller → breaker.fire()            ← opossum opens on sentinel, fast-fails
 *          → executeWithRetry()         ← idempotency-aware retry loop
 *          → executeAttempt()           ← fetch + AbortSignal.timeout + !res.ok
 *
 * Pure framework — ZERO per-API knowledge. Adapters subclass and inject their
 * own baseUrl / authHeader / logContext.
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PinoLogger } from 'nestjs-pino';
import type { Logger as PinoNativeLogger } from 'pino';
import type CircuitBreaker from 'opossum';
import {
  HTTP_CLIENT_CB_BREAKER_OPEN_MESSAGE_SUBSTRING,
  HTTP_CLIENT_LOG,
} from './http-client.constants';
import type {
  CbOptions,
  CircuitTransitionLogFields,
  HttpCallOpts,
  HttpClientLogFields,
  HttpMethod,
} from './http-client.types';
import {
  backoffWithJitter,
  normalizeError,
  resolveRetryPolicy,
  shouldRetry,
  sleep,
} from './retry.policy';
import { CircuitOpenError, HttpError } from './http-errors';
import { createCircuitBreaker } from './circuit-breaker.factory';

@Injectable()
export abstract class AbstractHttpClient implements OnModuleInit {
  // Pitfall 2 / Phase 23 Pitfall 6: defer creation to onModuleInit.
  private logger!: PinoNativeLogger;
  private breaker!: CircuitBreaker<[HttpMethod, string, RequestInit, HttpCallOpts], Response>;
  private getConsecutiveFailures!: () => number;

  constructor(
    private readonly cls: ClsService,
    protected readonly baseUrl: string,
    protected readonly defaultTimeoutMs: number,
    protected readonly cbOptions: CbOptions,
    private readonly logContext: string,
  ) {}

  /**
   * Override to inject auth headers on every request. Default: no headers.
   * Called per-request — subclass can compute dynamically (refresh OAuth
   * token, rotate API key, sign request). For static secrets (bot token,
   * API key from env), return `{ 'API-KEY': this.apiKey }` etc.
   *
   * Header name is the subclass's choice — `Authorization: Bearer <t>`,
   * `X-API-Key: <k>`, `API-KEY: <k>`, `X-Signature: <sig>`, whatever the
   * vendor requires.
   */
  protected buildAuthHeaders(): Record<string, string> {
    return {};
  }

  onModuleInit(): void {
    this.logger = PinoLogger.root.child({ context: this.logContext });
    const created = createCircuitBreaker<
      [HttpMethod, string, RequestInit, HttpCallOpts],
      Response
    >(
      (method, path, init, opts) => this.executeWithRetry(method, path, init, opts),
      this.logContext,
      this.cbOptions,
      (transition) => this.logCbTransition(transition),
    );
    this.breaker = created.breaker;
    this.getConsecutiveFailures = created.getConsecutiveFailures;
  }

  /**
   * Diagnostic accessor — returns current CB state and the wrapper's
   * consecutive-failure counter. Public for smoke / test endpoints; safe to
   * call from anywhere (read-only). For business code, prefer treating CB
   * as opaque and reacting to thrown CircuitOpenError.
   */
  public getCircuitState(): {
    cb: 'closed' | 'halfOpen' | 'opened';
    consecutiveFailures: number;
  } {
    const cb = this.breaker.opened
      ? 'opened'
      : this.breaker.halfOpen
        ? 'halfOpen'
        : 'closed';
    return { cb, consecutiveFailures: this.getConsecutiveFailures() };
  }

  protected get<T>(path: string, opts?: HttpCallOpts): Promise<T> {
    return this.request<T>('GET', path, this.buildInit(opts), opts ?? {});
  }
  protected post<T>(path: string, body: unknown, opts?: HttpCallOpts): Promise<T> {
    return this.request<T>('POST', path, this.buildJsonInit(body, opts), opts ?? {});
  }
  protected put<T>(path: string, body: unknown, opts?: HttpCallOpts): Promise<T> {
    return this.request<T>('PUT', path, this.buildJsonInit(body, opts), opts ?? {});
  }
  protected patch<T>(path: string, body: unknown, opts?: HttpCallOpts): Promise<T> {
    return this.request<T>('PATCH', path, this.buildJsonInit(body, opts), opts ?? {});
  }
  protected delete<T>(path: string, opts?: HttpCallOpts): Promise<T> {
    return this.request<T>('DELETE', path, this.buildInit(opts), opts ?? {});
  }

  protected async request<T>(
    method: HttpMethod,
    path: string,
    init: RequestInit,
    opts: HttpCallOpts,
  ): Promise<T> {
    try {
      const res = (await this.breaker.fire(method, path, init, opts)) as Response;
      return (await res.json()) as T;
    } catch (err) {
      // Pitfall 5: prefer `breaker.opened` boolean over message parsing;
      // substring match is a fallback for opossum's reject path.
      if (
        this.breaker.opened ||
        (err instanceof Error &&
          err.message.includes(HTTP_CLIENT_CB_BREAKER_OPEN_MESSAGE_SUBSTRING))
      ) {
        throw new CircuitOpenError(this.logContext);
      }
      throw err;
    }
  }

  private async executeWithRetry(
    method: HttpMethod,
    path: string,
    init: RequestInit,
    opts: HttpCallOpts,
  ): Promise<Response> {
    const policy = resolveRetryPolicy(method, opts);
    let lastErr: unknown;
    for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
      try {
        return await this.executeAttempt(method, path, init, opts);
      } catch (err) {
        lastErr = err;
        if (!shouldRetry(err, attempt, policy)) throw err;
        await sleep(backoffWithJitter(attempt, policy));
      }
    }
    throw lastErr;
  }

  private async executeAttempt(
    method: HttpMethod,
    path: string,
    init: RequestInit,
    opts: HttpCallOpts,
  ): Promise<Response> {
    const start = Date.now();
    const url = `${this.baseUrl}${path}`;
    const timeoutMs = opts.timeoutMs ?? this.defaultTimeoutMs;
    const signal = AbortSignal.timeout(timeoutMs);
    const mergedHeaders: Record<string, string> = {
      ...this.buildAuthHeaders(),
      ...((init.headers as Record<string, string> | undefined) ?? {}),
      ...(opts.headers ?? {}),
    };
    const finalInit: RequestInit = {
      ...init,
      method,
      signal,
      headers: mergedHeaders,
    };
    try {
      const res = await fetch(url, finalInit);
      // Pitfall 6: fetch does NOT throw on 4xx/5xx — explicit check required.
      if (!res.ok) {
        this.emitCallLog(method, url, res.status, start, HTTP_CLIENT_LOG.STATUS_ERROR);
        throw new HttpError(res.status, url);
      }
      this.emitCallLog(method, url, res.status, start, HTTP_CLIENT_LOG.STATUS_OK);
      return res;
    } catch (err) {
      if (err instanceof HttpError) throw err;
      const normalized = normalizeError(err, url, timeoutMs);
      this.emitCallLog(method, url, undefined, start, HTTP_CLIENT_LOG.STATUS_ERROR);
      throw normalized;
    }
  }

  private buildInit(opts?: HttpCallOpts): RequestInit {
    return { headers: opts?.headers };
  }

  private buildJsonInit(body: unknown, opts?: HttpCallOpts): RequestInit {
    return {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', ...(opts?.headers ?? {}) },
    };
  }

  private emitCallLog(
    method: HttpMethod,
    url: string,
    status_code: number | undefined,
    startedAt: number,
    status: typeof HTTP_CLIENT_LOG.STATUS_OK | typeof HTTP_CLIENT_LOG.STATUS_ERROR,
  ): void {
    const fields: HttpClientLogFields = {
      api: this.logContext,
      method,
      url,
      duration_ms: Date.now() - startedAt,
      status_code,
      // D-16: body NEVER logged.
      status,
      correlationId: this.cls.getId(),
    };
    const level = status === HTTP_CLIENT_LOG.STATUS_OK ? 'info' : 'error';
    this.logger[level](fields, HTTP_CLIENT_LOG.EVENT_CALL);
  }

  private logCbTransition(
    transition:
      | typeof HTTP_CLIENT_LOG.CB_OPEN
      | typeof HTTP_CLIENT_LOG.CB_HALF_OPEN
      | typeof HTTP_CLIENT_LOG.CB_CLOSE,
  ): void {
    const fields: CircuitTransitionLogFields = { api: this.logContext, transition };
    const level = transition === HTTP_CLIENT_LOG.CB_CLOSE ? 'info' : 'warn';
    this.logger[level](fields, HTTP_CLIENT_LOG.EVENT_CB_TRANSITION);
  }
}
