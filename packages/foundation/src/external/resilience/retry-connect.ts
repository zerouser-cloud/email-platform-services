export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export const RETRY_DEFAULTS: RetryOptions = {
  maxRetries: 5,
  baseDelayMs: 200,
  maxDelayMs: 5000,
};

interface RetryLogger {
  info: (obj: object, msg: string) => void;
  warn: (obj: object, msg: string) => void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryConnect<T>(
  name: string,
  connectFn: () => Promise<T>,
  logger: RetryLogger,
  options?: Partial<RetryOptions>,
): Promise<T> {
  const { maxRetries, baseDelayMs, maxDelayMs } = { ...RETRY_DEFAULTS, ...options };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await connectFn();
      logger.info({ dependency: name }, `Connected to ${name}`);
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      if (attempt === maxRetries) {
        throw new Error(`Failed to connect to ${name} after ${maxRetries} attempts: ${message}`);
      }

      const delay =
        Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs) +
        Math.floor(Math.random() * baseDelayMs);
      logger.warn(
        { dependency: name, attempt, maxRetries, retryInMs: delay },
        `Waiting for ${name}...`,
      );
      await sleep(delay);
    }
  }

  throw new Error(`Failed to connect to ${name} after ${maxRetries} attempts`);
}
