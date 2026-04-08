import { z } from 'zod';
import { composeSchemas } from './compose';
import { TopologySchema, type GlobalTopology } from './topology';
import {
  DatabaseSchema,
  RedisSchema,
  RabbitSchema,
  StorageSchema,
  LoggingSchema,
  GrpcSchema,
  CorsSchema,
  RateLimitSchema,
  type DatabaseConfig,
  type RedisConfig,
  type RabbitConfig,
  type StorageConfig,
  type LoggingConfig,
  type GrpcConfig,
  type CorsConfig,
  type RateLimitConfig,
} from './schemas';

const BaseGlobalEnvSchema = composeSchemas(
  TopologySchema,
  DatabaseSchema,
  RedisSchema,
  RabbitSchema,
  StorageSchema,
  LoggingSchema,
  GrpcSchema,
  CorsSchema,
  RateLimitSchema,
);

export const GlobalEnvSchema = BaseGlobalEnvSchema.refine(
  (data) => !(data.CORS_STRICT && data.CORS_ORIGINS === '*'),
  {
    message:
      'CORS_ORIGINS cannot be "*" when CORS_STRICT is enabled. Specify explicit origins.',
    path: ['CORS_ORIGINS'],
  },
);

/**
 * Manually composed type for GlobalEnv. Required because TopologySchema uses
 * a dynamic shape (buildTopologyShape), so z.infer cannot resolve field names
 * at the type level. Sub-schema types are statically inferred.
 */
export type GlobalEnv = GlobalTopology &
  DatabaseConfig &
  RedisConfig &
  RabbitConfig &
  StorageConfig &
  LoggingConfig &
  GrpcConfig &
  CorsConfig &
  RateLimitConfig;
