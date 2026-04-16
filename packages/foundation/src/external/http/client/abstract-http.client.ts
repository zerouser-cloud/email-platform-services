/**
 * AbstractHttpClient — thin orchestrator over DI-injected collaborators (D-01).
 *
 * REQUIREMENT (D-36): the subclass's DI module MUST have `ClsModule` imported
 * somewhere in the graph (transitively via `LoggingModule.forHttp()` /
 * `LoggingModule.forGrpc()` is sufficient — current project setup).
 * `HttpClientDeps.cls` is resolved at provider-construction time via
 * `httpClientProvider`; absence crashes with "ClsService not injected".
 *
 * Execution stack (outer to inner):
 *
 *     request() → breaker.fire(() => retry.run(() => executor.execute()))
 *
 * Pure framework — ZERO per-API knowledge. Vendor adapters subclass and supply
 * their own auth headers via `buildAuthHeaders()`.
 *
 * Lifecycle: NO lifecycle hooks here (D-01). The logger adapter owns
 * Pitfall 6 (root-child deferred init) internally via its private
 * `ensureInit()` guard; this class stays synchronous from a DI-assembly
 * perspective — safe when constructed manually inside `httpClientProvider`'s
 * `useFactory` (Plan 02).
 *
 * CircuitBreaker generic contract (W-2 lock): `HttpClientDeps.breaker` is
 * narrowed to `CircuitBreakerPort<[() => Promise<Response>], Response>` —
 * `request()` passes `() => retry.run(attempt, policy)` as the single `fire`
 * arg. The breaker adapter's inner function is a trivial invoker
 * `(work) => work()` (Plan 02 Task 2) so each call captures fresh closure
 * state (path / method / opts / init) dynamically, while adapter construction
 * stays static.
 */

import { Injectable } from '@nestjs/common';
import { HTTP_CLIENT_HEADERS } from './request.constants';
import type { HttpClientDeps } from './http-client-deps';
import type { CircuitState, HttpCallOpts, HttpMethod } from './types';

@Injectable()
export abstract class AbstractHttpClient {
  constructor(protected readonly deps: HttpClientDeps) {}

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

  /**
   * Hook for vendor subclasses that need header-based auth.
   * Base implementation returns no headers (Telegram uses path-embedded token).
   */
  protected buildAuthHeaders(): Record<string, string> {
    return {};
  }

  public getCircuitState(): CircuitState {
    return this.deps.breaker.state;
  }

  protected async request<T>(
    method: HttpMethod,
    path: string,
    init: RequestInit,
    opts: HttpCallOpts,
  ): Promise<T> {
    const policy = this.deps.retry.resolvePolicy(method, opts);
    const attempt = (): Promise<Response> =>
      this.deps.executor.execute(
        method,
        path,
        init,
        opts,
        this.deps.baseUrl,
        this.buildAuthHeaders(),
        this.deps.defaultTimeoutMs,
        this.deps.logContext,
      );
    const res = await this.deps.breaker.fire(() => this.deps.retry.run(attempt, policy));
    // TODO(deferred — Zod validation phase, D-37): response shape is cast
    // blindly. Adapter is responsible for any runtime validation until a
    // centralised schema-driven path is introduced. Tracked in ROADMAP backlog
    // (future phase).
    return (await res.json()) as T;
  }

  private buildInit(opts?: HttpCallOpts): RequestInit {
    return { headers: opts?.headers };
  }

  private buildJsonInit(body: unknown, opts?: HttpCallOpts): RequestInit {
    return {
      body: JSON.stringify(body),
      headers: {
        [HTTP_CLIENT_HEADERS.CONTENT_TYPE]: HTTP_CLIENT_HEADERS.APPLICATION_JSON,
        ...(opts?.headers ?? {}),
      },
    };
  }
}
