/**
 * Circuit breaker factory built on opossum 9.x.
 *
 * opossum's native model is percentage-based in a rolling window — it has no
 * "open after N consecutive failures" mode (verified against opossum/lib/
 * circuit.js, the deprecated maxFailures option was removed). Low-traffic
 * callers (e.g. notifier sending 1 message/min) would never satisfy
 * volumeThreshold inside the rolling window, so a percentage-based CB would
 * never open for them. We need exact consecutive semantics independent of
 * traffic cadence.
 *
 * Approach: drive opening ourselves via `breaker.open()` and tell opossum to
 * ignore its auto-open stats entirely (`errorFilter: () => true`). opossum
 * still manages halfOpen/close transitions via `resetTimeout` (half-open
 * probe, close on success) — we just short-circuit its opening decision.
 *
 * Pitfall 1: `timeout: false` is MANDATORY. opossum's per-fire timeout would
 * race our retry loop (each attempt has its own AbortSignal.timeout).
 *
 * Internal to the http layer — NOT exported from the foundation barrel.
 */

import CircuitBreaker from 'opossum';
import { HTTP_CLIENT_LOG } from './http-client.constants';
import type { CbOptions } from './http-client.types';

type Transition =
  | typeof HTTP_CLIENT_LOG.CB_OPEN
  | typeof HTTP_CLIENT_LOG.CB_HALF_OPEN
  | typeof HTTP_CLIENT_LOG.CB_CLOSE;

export interface CreatedCircuitBreaker<TArgs extends unknown[], TReturn> {
  breaker: CircuitBreaker<TArgs, TReturn>;
  getConsecutiveFailures: () => number;
}

export function createCircuitBreaker<TArgs extends unknown[], TReturn>(
  innerFn: (...args: TArgs) => Promise<TReturn>,
  _api: string,
  cbOptions: CbOptions,
  onTransition: (transition: Transition) => void,
): CreatedCircuitBreaker<TArgs, TReturn> {
  let consecutiveFailures = 0;
  // Holder lets `wrapped` (defined before breaker) reference the breaker
  // through a stable object whose property is mutated after construction.
  // Plain `let` here trips eslint prefer-const since the binding itself is
  // assigned exactly once.
  const ref: { breaker?: CircuitBreaker<TArgs, TReturn> } = {};

  const wrapped = async (...args: TArgs): Promise<TReturn> => {
    try {
      const result = await innerFn(...args);
      consecutiveFailures = 0;
      return result;
    } catch (err) {
      // Textbook CB semantics: a half-open probe that fails must reopen the
      // circuit immediately. Without this, our `errorFilter: () => true`
      // makes opossum treat every probe failure as success and auto-close.
      if (ref.breaker?.halfOpen) {
        consecutiveFailures = 0;
        ref.breaker.open();
        throw err;
      }
      consecutiveFailures += 1;
      if (consecutiveFailures >= cbOptions.consecutiveThreshold) {
        consecutiveFailures = 0;
        ref.breaker?.open();
      }
      throw err;
    }
  };

  const breaker = new CircuitBreaker<TArgs, TReturn>(wrapped, {
    resetTimeout: cbOptions.halfOpenAfterMs,
    // Pitfall 1: opossum per-fire timeout must NOT race the retry loop's
    // per-attempt AbortSignal.timeout.
    timeout: false,
    // Delegate "when to open" entirely to the wrapper's ref.breaker.open()
    // call. Returning true tells opossum to treat every thrown error as
    // filtered (not a failure for stats purposes). opossum's percentage
    // evaluator never opens the circuit; only our explicit open() does.
    errorFilter: () => true,
  });

  ref.breaker = breaker;

  breaker.on('open', () => onTransition(HTTP_CLIENT_LOG.CB_OPEN));
  breaker.on('halfOpen', () => onTransition(HTTP_CLIENT_LOG.CB_HALF_OPEN));
  breaker.on('close', () => onTransition(HTTP_CLIENT_LOG.CB_CLOSE));

  return { breaker, getConsecutiveFailures: () => consecutiveFailures };
}
