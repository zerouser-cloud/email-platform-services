import { z } from 'zod';
import { TopologySchema } from './topology';
import { InfrastructureSchema } from './infrastructure';
import { LOG_FORMAT, LOG_LEVEL, type LogFormat, type LogLevel } from './env-constants';
import type { GlobalTopology } from './topology';
import type { InfrastructureConfig } from './infrastructure';

export const GlobalEnvSchema = z
  .object({
    ...TopologySchema.shape,
    ...InfrastructureSchema.shape,
    PROTO_DIR: z.string().min(1).optional(),
    CORS_STRICT: z.coerce.boolean().default(false),
    LOG_LEVEL: z.enum([
      LOG_LEVEL.TRACE,
      LOG_LEVEL.DEBUG,
      LOG_LEVEL.INFO,
      LOG_LEVEL.WARN,
      LOG_LEVEL.ERROR,
      LOG_LEVEL.FATAL,
    ]),
    LOG_FORMAT: z.enum([LOG_FORMAT.JSON, LOG_FORMAT.PRETTY]),
    CORS_ORIGINS: z.string().min(1),
    GRPC_DEADLINE_MS: z.coerce.number().positive(),
    RATE_LIMIT_BURST_TTL: z.coerce.number().positive(),
    RATE_LIMIT_BURST_LIMIT: z.coerce.number().positive(),
    RATE_LIMIT_SUSTAINED_TTL: z.coerce.number().positive(),
    RATE_LIMIT_SUSTAINED_LIMIT: z.coerce.number().positive(),
  })
  .refine(
    (data) => !(data.CORS_STRICT && data.CORS_ORIGINS === '*'),
    {
      message:
        'CORS_ORIGINS cannot be "*" when CORS_STRICT is enabled. Specify explicit origins.',
      path: ['CORS_ORIGINS'],
    },
  );

export type GlobalEnv = GlobalTopology &
  InfrastructureConfig & {
    PROTO_DIR?: string;
    CORS_STRICT: boolean;
    LOG_LEVEL: LogLevel;
    LOG_FORMAT: LogFormat;
    CORS_ORIGINS: string;
    GRPC_DEADLINE_MS: number;
    RATE_LIMIT_BURST_TTL: number;
    RATE_LIMIT_BURST_LIMIT: number;
    RATE_LIMIT_SUSTAINED_TTL: number;
    RATE_LIMIT_SUSTAINED_LIMIT: number;
  };
