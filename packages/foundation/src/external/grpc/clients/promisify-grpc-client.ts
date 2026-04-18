// File: packages/foundation/src/external/grpc/clients/promisify-grpc-client.ts
// Source: D-07 + D-08 + Pitfall 3 refinement
import { Metadata } from '@grpc/grpc-js';
import { type Observable, lastValueFrom } from 'rxjs';
import { GRPC_CLIENT_DEADLINE } from './clients.constants';
import type { CallOpts } from './grpc-client-logging.types';

/**
 * Maps every `(...args) => Observable<R>` method on T to `(...args) => Promise<R>`.
 * Non-function properties and intentional Observable returns (future streaming) pass through.
 *
 * Edge cases:
 * - Optional methods (T[K] = undefined | (...) => Observable<R>): pass through unchanged.
 *   ts-proto-generated XxxServiceClient interfaces have no optional methods; not a concern today.
 * - Generic methods (<T>(req: R<T>) => Observable<T>): TypeScript distributes the conditional
 *   over generics correctly. ts-proto does not generate generic methods; not a concern today.
 */
export type Promisified<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => Observable<infer R>
    ? (...args: A) => Promise<R>
    : T[K];
};

export interface PromisifyOpts {
  readonly defaultDeadlineMs: number;
}

/**
 * Wrap a raw `ClientGrpc.getService<T>()` return in a typed Promise-returning Proxy.
 * The Proxy:
 *   1. Filters by RPC method name (snapshotted at construction) — does NOT wrap inherited
 *      Object.prototype methods (toString, valueOf, hasOwnProperty, etc.)
 *   2. Builds Metadata with grpc-timeout deadline header per call (default + per-call override)
 *   3. Converts Observable -> Promise via lastValueFrom
 *
 * No logging, no tracing, no retry — those are deliberate omissions per phase 999.7.3 D-03..D-05.
 * Future observability phase will compose an outer Proxy (`wrapWithObservability`) around this
 * inner Proxy via DI-injected logger/cls.
 *
 * Channel binding: `grpc.getService(name)` inside useFactory creates the gRPC channel
 * synchronously and caches it. No network I/O until first RPC method call.
 */
export function promisifyGrpcClient<T extends object>(
  raw: T,
  opts: PromisifyOpts,
): Promisified<T> {
  // ClientGrpc.getService(name) returns a plain object with own keys equal to RPC method
  // names — verified in @nestjs/microservices/client/client-grpc.js:38-50.
  const rpcMethods = new Set(Object.keys(raw));

  return new Proxy(raw, {
    get(target, prop, receiver): unknown {
      if (typeof prop !== 'string' || !rpcMethods.has(prop)) {
        return Reflect.get(target, prop, receiver);
      }
      const orig = Reflect.get(target, prop, receiver) as
        | ((req: unknown, meta?: Metadata) => Observable<unknown>)
        | undefined;
      if (typeof orig !== 'function') {
        return orig;
      }

      return async (request: unknown, callOpts?: CallOpts): Promise<unknown> => {
        const deadlineMs = callOpts?.deadlineMs ?? opts.defaultDeadlineMs;
        const meta = new Metadata();
        meta.set(
          GRPC_CLIENT_DEADLINE.METADATA_HEADER,
          `${deadlineMs}${GRPC_CLIENT_DEADLINE.METADATA_UNIT_MILLISECONDS}`,
        );
        return lastValueFrom(orig.call(target, request, meta));
      };
    },
  }) as Promisified<T>;
}
