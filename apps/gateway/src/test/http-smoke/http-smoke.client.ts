// TODO(remove-before-release): diagnostic HTTP client for Phase 24 framework smoke.
// Generic AbstractHttpClient subclass — no auth, no specific vendor — used only by
// HttpSmokeController to exercise retry / CB / timeout / logging behaviour against
// httpbin.org. Public passthrough methods expose protected base verbs.

import { Injectable } from '@nestjs/common';
import { AbstractHttpClient, type HttpCallOpts } from '@email-platform/foundation';

@Injectable()
export class HttpSmokeClient extends AbstractHttpClient {
  smokeGet<T = unknown>(path: string, opts?: HttpCallOpts): Promise<T> {
    return this.get<T>(path, opts);
  }

  smokePost<T = unknown>(path: string, body: unknown, opts?: HttpCallOpts): Promise<T> {
    return this.post<T>(path, body, opts);
  }
}
