/**
 * Circuit breaker factory built on opossum 9.x.
 *
 * Option B (from 24-RESEARCH Q1): wrap the inner fn with a consecutive-failure
 * counter that throws `ConsecutiveThresholdError` after N failures in a row.
 * Configure opossum with volumeThreshold:1 + errorThresholdPercentage:100 +
 * `timeout: false` so it opens deterministically on that single sentinel.
 *
 * Pitfall 1: `timeout: false` is MANDATORY. opossum's per-fire timeout would
 * race our retry loop (each attempt has its own AbortSignal.timeout).
 *
 * Internal to the http layer — NOT exported from the foundation barrel.
 */

import CircuitBreaker from 'opossum';
import { HTTP_CLIENT_DEFAULTS, HTTP_CLIENT_LOG } from './http-client.constants';
import type { CbOptions } from './http-client.types';
import { ConsecutiveThresholdError } from './http-errors';

type Transition =
  | typeof HTTP_CLIENT_LOG.CB_OPEN
  | typeof HTTP_CLIENT_LOG.CB_HALF_OPEN
  | typeof HTTP_CLIENT_LOG.CB_CLOSE;

export function createCircuitBreaker<TArgs extends unknown[], TReturn>(
  innerFn: (...args: TArgs) => Promise<TReturn>,
  api: string,
  cbOptions: CbOptions,
  onTransition: (transition: Transition) => void,
): CircuitBreaker<TArgs, TReturn> {
  let consecutiveFailures = 0;

  const wrapped = async (...args: TArgs): Promise<TReturn> => {
    try {
      const result = await innerFn(...args);
      consecutiveFailures = 0;
      return result;
    } catch (err) {
      consecutiveFailures += 1;
      if (consecutiveFailures >= cbOptions.consecutiveThreshold) {
        consecutiveFailures = 0;
        throw new ConsecutiveThresholdError(api, cbOptions.consecutiveThreshold);
      }
      throw err;
    }
  };

  const breaker = new CircuitBreaker<TArgs, TReturn>(wrapped, {
    errorThresholdPercentage: HTTP_CLIENT_DEFAULTS.CB_ERROR_PERCENT,
    volumeThreshold: HTTP_CLIENT_DEFAULTS.CB_VOLUME_THRESHOLD,
    resetTimeout: cbOptions.halfOpenAfterMs,
    // Pitfall 1: MANDATORY — opossum's per-fire timeout must NOT race our
    // per-attempt AbortSignal.timeout in the retry loop.
    timeout: false,
  });

  breaker.on('open', () => onTransition(HTTP_CLIENT_LOG.CB_OPEN));
  breaker.on('halfOpen', () => onTransition(HTTP_CLIENT_LOG.CB_HALF_OPEN));
  breaker.on('close', () => onTransition(HTTP_CLIENT_LOG.CB_CLOSE));

  return breaker;
}
