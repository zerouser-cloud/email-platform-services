/**
 * httpClientProvider — NestJS provider factory for per-vendor AbstractHttpClient
 * subclasses (D-22). Eliminates the ~25-line useFactory boilerplate previously
 * duplicated across 4 per-vendor modules (telegram/appstorespy/cloudfn/
 * http-smoke).
 *
 * The factory:
 *   1. Reads `baseUrl` via typed env slice indexed by `baseUrlEnvKey`
 *      (Phase 999.11.1 D-10 — foundation is service-agnostic, apps provide a
 *      narrow `{Svc}Env` slice via `envToken`). For smoke/test clients with
 *      a constant target URL, `baseUrlLiteral` bypasses the env lookup.
 *   2. Constructs FRESH per-vendor collaborators (logger, normaliser, executor,
 *      retry, breaker) — per-vendor CB isolation preserved (D-08 / Phase 24).
 *   3. Assembles the `HttpClientDeps` param-bag.
 *   4. Delegates final construction to caller-supplied `build(deps + env)`
 *      callback — vendor code reads additional vendor-specific env vars via
 *      typed access (`deps.env[VENDOR_ENV.API_KEY]`) inside `build`.
 *
 * Manual-construction lifecycle note: `PinoHttpClientLoggerAdapter` is
 * instantiated directly here (not DI-resolved), so NestJS `onModuleInit`
 * never fires for it — Plan 01 Task 2 already ships a private `ensureInit()`
 * lazy guard inside the adapter that performs `PinoLogger.root.child(...)` on
 * first `call()` / `transition()` invocation.
 *
 * Inner-closure design: the breaker's `innerFn` is a trivial invoker
 * `(work) => work()`. `AbstractHttpClient.request` passes
 * `() => retry.run(attempt, policy)` at fire time, so per-call closure state
 * (path / method / opts / init) flows through dynamically while the adapter
 * itself is constructed statically.
 */

import type { Provider } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

import type { AbstractHttpClient } from '../client/abstract-http.client';
import type { HttpClientDeps } from '../client/http-client-deps';
import type { CbOptions } from '../client/types';

import { HttpRequestExecutor } from '../client/request-executor';
import { DefaultRetryExecutor } from '../retry/default-retry-executor';
import { OpossumCircuitBreakerAdapter } from '../circuit-breaker/opossum-circuit-breaker.adapter';
import { PinoHttpClientLoggerAdapter } from '../logger/pino-http-client-logger.adapter';

import { HttpErrorNormalizer } from '../errors/http-error-normalizer';
import { TimeoutErrorMapper } from '../errors/mappers/timeout-error.mapper';
import { NetworkErrorMapper } from '../errors/mappers/network-error.mapper';
import { FallbackErrorMapper } from '../errors/mappers/fallback-error.mapper';

import { CB_DEFAULTS } from '../circuit-breaker/constants';

/**
 * Default per-attempt timeout for HTTP requests (ms). Framework-level default;
 * adapters may override via `HttpClientProviderOpts.timeoutMs`. Not env-driven
 * (D-15) — framework default, not application configuration.
 */
const DEFAULT_TIMEOUT_MS = 5_000;

export interface HttpClientProviderOpts {
  readonly token: symbol;
  readonly logContext: string;
  /**
   * DI token for the app's narrow env config (e.g. `NOTIFIER_CONFIG`). The
   * factory injects this token to read `baseUrl` (and the `build` callback
   * reads additional vendor fields) via typed index access on `TEnv`.
   * Required — foundation is service-agnostic and never injects the
   * global NestJS config service directly (Phase 999.11.1 D-10).
   */
  readonly envToken: symbol;
  /** Env var name whose value becomes the client's baseUrl (looked up as `env[baseUrlEnvKey]`). Mutually exclusive with `baseUrlLiteral`. */
  readonly baseUrlEnvKey?: string;
  /** Literal baseUrl (used for smoke/test clients that point to a constant target URL). Mutually exclusive with `baseUrlEnvKey`. */
  readonly baseUrlLiteral?: string;
  readonly timeoutMs?: number;
  readonly cb?: Partial<CbOptions>;
}

export function httpClientProvider<
  T extends AbstractHttpClient,
  TEnv extends Record<string, unknown> = Record<string, unknown>,
>(opts: HttpClientProviderOpts, build: (deps: HttpClientDeps & { env: TEnv }) => T): Provider {
  // Developer-time guard — exactly one baseUrl source required.
  if (
    (!opts.baseUrlEnvKey && !opts.baseUrlLiteral) ||
    (opts.baseUrlEnvKey && opts.baseUrlLiteral)
  ) {
    throw new Error('httpClientProvider: provide exactly one of baseUrlEnvKey or baseUrlLiteral');
  }

  return {
    provide: opts.token,
    inject: [opts.envToken, ClsService],
    useFactory: (env: TEnv, cls: ClsService): T => {
      const logger = new PinoHttpClientLoggerAdapter(cls, opts.logContext);
      const normalizer = new HttpErrorNormalizer([
        new TimeoutErrorMapper(),
        new NetworkErrorMapper(),
        new FallbackErrorMapper(),
      ]);
      const executor = new HttpRequestExecutor(normalizer, logger);
      const retry = new DefaultRetryExecutor();

      const cbOpts = {
        consecutiveThreshold: opts.cb?.consecutiveThreshold ?? CB_DEFAULTS.CB_CONSECUTIVE_THRESHOLD,
        halfOpenAfterMs: opts.cb?.halfOpenAfterMs ?? CB_DEFAULTS.CB_HALF_OPEN_AFTER_MS,
        api: opts.logContext,
      };

      // Inner-closure design: the breaker invokes a caller-supplied zero-arg
      // closure. AbstractHttpClient.request passes `() => retry.run(...)` at
      // fire time, so per-call state is captured dynamically.
      const breaker = new OpossumCircuitBreakerAdapter<[() => Promise<Response>], Response>(
        (work) => work(),
        cbOpts,
        (transition) => logger.transition({ api: opts.logContext, transition }),
      );

      const baseUrl = opts.baseUrlLiteral
        ? opts.baseUrlLiteral
        : (env[opts.baseUrlEnvKey as string] as string);

      const deps: HttpClientDeps = {
        cls,
        logger,
        executor,
        retry,
        breaker,
        baseUrl,
        defaultTimeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        logContext: opts.logContext,
      };

      return build({ ...deps, env });
    },
  };
}
