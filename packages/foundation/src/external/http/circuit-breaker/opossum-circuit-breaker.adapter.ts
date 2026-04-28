/**
 * OpossumCircuitBreakerAdapter — opossum-backed `CircuitBreakerPort` (D-04, D-12).
 *
 * Encapsulates all opossum-specific concerns in ONE class:
 *   - Consecutive-failure counter (opossum v9 has only percentage/rolling
 *     window; low-traffic callers never reach `volumeThreshold`) — we drive
 *     open() ourselves with `errorFilter: () => true` (Pitfall 2).
 *   - `timeout: false` — per-attempt timeout lives in `HttpRequestExecutor`
 *     only; opossum's per-fire timeout must NOT race the retry loop
 *     (Pitfall 3).
 *   - Half-open probe failure MUST reopen immediately (Pitfall 4) — without
 *     this, `errorFilter: () => true` makes opossum treat every probe failure
 *     as success and auto-close.
 *   - Fragile substring match `'Breaker is open'` stays PRIVATE (D-13) —
 *     fire() always raises `CircuitOpenError` to callers.
 *   - `dispose()` detaches listeners and calls `breaker.shutdown()` —
 *     critical for deterministic test teardown.
 *
 * Source: rewrite of Phase 24 `circuit-breaker.factory.ts:37-92`. The
 * `ref.breaker?.open()` holder-object smell disappears because the breaker
 * field is initialised in the constructor before the wrapper is bound.
 */

import CircuitBreaker from 'opossum';
import type { CbOptions, CircuitState } from '../client/types';
import { CircuitOpenError } from '../errors/circuit-open.error';
import type { CircuitBreakerPort } from './circuit-breaker.port';
import { CB_BREAKER_OPEN_MESSAGE_SUBSTRING } from './constants';

type Transition = 'open' | 'halfOpen' | 'close';
type ListenerPair = [Transition, () => void];

export class OpossumCircuitBreakerAdapter<
  TArgs extends unknown[],
  TReturn,
> implements CircuitBreakerPort<TArgs, TReturn> {
  private readonly breaker: CircuitBreaker<TArgs, TReturn>;
  private consecutiveFailures = 0;
  private readonly listeners: ListenerPair[] = [];

  constructor(
    innerFn: (...args: TArgs) => Promise<TReturn>,
    private readonly opts: CbOptions & { readonly api: string },
    private readonly onTransition: (t: Transition) => void,
  ) {
    const wrapped = this.wrap(innerFn);
    this.breaker = new CircuitBreaker<TArgs, TReturn>(wrapped, {
      resetTimeout: opts.halfOpenAfterMs,
      // Pitfall 3 — per-attempt timeout lives in HttpRequestExecutor only.
      timeout: false,
      // Pitfall 2 — opossum v9 has no consecutive mode; we drive open() ourselves.
      errorFilter: () => true,
    });
    this.wireEvents();
  }

  private wrap(inner: (...a: TArgs) => Promise<TReturn>): (...a: TArgs) => Promise<TReturn> {
    return async (...args: TArgs) => {
      try {
        const r = await inner(...args);
        this.consecutiveFailures = 0;
        return r;
      } catch (err) {
        // Pitfall 4: halfOpen probe failure MUST reopen the circuit.
        if (this.breaker.halfOpen) {
          this.consecutiveFailures = 0;
          this.breaker.open();
          throw err;
        }
        this.consecutiveFailures += 1;
        if (this.consecutiveFailures >= this.opts.consecutiveThreshold) {
          this.consecutiveFailures = 0;
          this.breaker.open();
        }
        throw err;
      }
    };
  }

  private wireEvents(): void {
    // Bind each transition explicitly — opossum's `on()` uses literal-string
    // overloads (`'open'`, `'halfOpen'`, `'close'`, `'failure'`, ...). Passing
    // a union-typed `ev: Transition` resolves to the wrong overload
    // (`'failure'` signature takes different args).
    const openFn = (): void => this.onTransition('open');
    const halfOpenFn = (): void => this.onTransition('halfOpen');
    const closeFn = (): void => this.onTransition('close');
    this.breaker.on('open', openFn);
    this.breaker.on('halfOpen', halfOpenFn);
    this.breaker.on('close', closeFn);
    this.listeners.push(['open', openFn], ['halfOpen', halfOpenFn], ['close', closeFn]);
  }

  async fire(...args: TArgs): Promise<TReturn> {
    try {
      return await this.breaker.fire(...args);
    } catch (err) {
      // D-13: fragile substring match stays PRIVATE here; callers only ever
      // see CircuitOpenError.
      if (
        this.breaker.opened ||
        (err instanceof Error && err.message.includes(CB_BREAKER_OPEN_MESSAGE_SUBSTRING))
      ) {
        throw new CircuitOpenError(this.opts.api);
      }
      throw err;
    }
  }

  get state(): CircuitState {
    const cb = this.breaker.opened ? 'opened' : this.breaker.halfOpen ? 'halfOpen' : 'closed';
    return { cb, consecutiveFailures: this.consecutiveFailures };
  }

  dispose(): void {
    // Opossum's `on()` has narrowly-typed overloads per event; the inherited
    // `off` / `removeListener` from EventEmitter resolves to a stricter
    // overload set. Cast the tuple elements through `unknown` to bypass the
    // mismatch — the runtime behaviour is standard EventEmitter removal.
    for (const [ev, fn] of this.listeners) {
      (this.breaker as unknown as { off: (ev: string, fn: () => void) => void }).off(ev, fn);
    }
    this.breaker.shutdown();
  }
}
