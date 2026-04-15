/**
 * Typed error hierarchy for the foundation HTTP client.
 * Consumers (adapters) may `instanceof`-discriminate these at call sites.
 */

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
  ) {
    super(`HTTP ${status} ${url}`);
    this.name = 'HttpError';
  }
}

export class TimeoutError extends Error {
  constructor(
    public readonly url: string,
    public readonly timeoutMs: number,
  ) {
    super(`Request timed out after ${timeoutMs}ms: ${url}`);
    this.name = 'TimeoutError';
  }
}

export class NetworkError extends Error {
  constructor(
    public readonly url: string,
    public readonly cause: unknown,
  ) {
    super(`Network error for ${url}`);
    this.name = 'NetworkError';
  }
}

export class CircuitOpenError extends Error {
  constructor(public readonly api: string) {
    super(`Circuit open for ${api}`);
    this.name = 'CircuitOpenError';
  }
}

export class ConsecutiveThresholdError extends Error {
  constructor(
    public readonly api: string,
    public readonly threshold: number,
  ) {
    super(`Consecutive failure threshold (${threshold}) reached for ${api}`);
    this.name = 'ConsecutiveThresholdError';
  }
}
