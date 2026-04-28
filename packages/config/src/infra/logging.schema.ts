import { z } from 'zod';
import { LOG_FORMAT, LOG_LEVEL } from '../env-constants';

export const LoggingSchema = z.object({
  LOG_LEVEL: z.enum([
    LOG_LEVEL.TRACE,
    LOG_LEVEL.DEBUG,
    LOG_LEVEL.INFO,
    LOG_LEVEL.WARN,
    LOG_LEVEL.ERROR,
    LOG_LEVEL.FATAL,
  ]),
  LOG_FORMAT: z.enum([LOG_FORMAT.JSON, LOG_FORMAT.PRETTY]),
});

export type LoggingConfig = z.infer<typeof LoggingSchema>;
