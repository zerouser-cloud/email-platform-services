import { Injectable } from '@nestjs/common';
import { AbstractHttpClient, type HttpCallOpts } from '@email-platform/foundation';

/**
 * HttpSmokeClient — runtime diagnostic wrapper around AbstractHttpClient used by
 * the temporary HttpSmokeController in apps/gateway/src/test/http-smoke/ to
 * exercise retry + circuit breaker + timeout behaviour against httpbin.org.
 *
 * This client stays PRODUCTION-REACHABLE in infrastructure/ even after the test/
 * controller is removed before release (D-24, D-25, D-28). Final disposition is
 * deferred to a future phase (admin diagnostic / health probe / baseline).
 *
 * Generic AbstractHttpClient subclass — no auth, no specific vendor. Public
 * passthrough methods expose the protected base verbs (get/post) so the
 * diagnostic controller can drive framework behaviour without bypassing the
 * client's orchestration layer.
 */
@Injectable()
export class HttpSmokeClient extends AbstractHttpClient {
  smokeGet<T = unknown>(path: string, opts?: HttpCallOpts): Promise<T> {
    return this.get<T>(path, opts);
  }

  smokePost<T = unknown>(path: string, body: unknown, opts?: HttpCallOpts): Promise<T> {
    return this.post<T>(path, body, opts);
  }
}
