import {
  composeSchemas,
  TopologySchema,
  DatabaseSchema,
  RedisSchema,
  LoggingSchema,
  GrpcSchema,
  type GlobalTopology,
  type DatabaseConfig,
  type RedisConfig,
  type LoggingConfig,
  type GrpcConfig,
} from '@email-platform/config';

export const SenderEnvSchema = composeSchemas(
  TopologySchema,
  DatabaseSchema,
  RedisSchema,
  LoggingSchema,
  GrpcSchema,
);

export type SenderEnv = GlobalTopology & DatabaseConfig & RedisConfig & LoggingConfig & GrpcConfig;
