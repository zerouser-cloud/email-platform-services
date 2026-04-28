/**
 * NetworkErrorMapper — maps fetch-layer `TypeError` (with `cause`) to the
 * foundation `NetworkError` (D-09 chain link 2).
 *
 * Pitfall 7: `fetch` network failures surface as `TypeError` with a native
 * ES2022 `cause` property. This mapper relies on `err.cause` being the native
 * `Error.cause` (D-08) — no ad-hoc cause field required.
 *
 * Source: extracted from Phase 24 `retry.policy.ts:78-80` — the old cast
 * `(err as TypeError & { cause: unknown }).cause` is no longer needed because
 * `Error.cause` is native.
 */

import type { ErrorMapper } from '../error-mapper.port';
import { NetworkError } from '../network.error';

export class NetworkErrorMapper implements ErrorMapper {
  matches(err: unknown): boolean {
    return err instanceof TypeError && 'cause' in err;
  }

  map(err: unknown, ctx: { url: string; timeoutMs: number }): Error {
    // err is TypeError; `cause` is native ES2022 readonly property on Error.
    return new NetworkError(ctx.url, (err as Error).cause);
  }
}
