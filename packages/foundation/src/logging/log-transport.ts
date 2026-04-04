import type { TransportSingleOptions } from 'pino';
import { LOG_FORMAT, type LogFormat } from '@email-platform/config';

type PinoTransport = TransportSingleOptions | undefined;

const TRANSPORTS: Record<LogFormat, PinoTransport> = {
  [LOG_FORMAT.JSON]: undefined,
  [LOG_FORMAT.PRETTY]: { target: 'pino-pretty', options: { colorize: true } },
};

export function resolveTransport(format: LogFormat): PinoTransport {
  return TRANSPORTS[format];
}
