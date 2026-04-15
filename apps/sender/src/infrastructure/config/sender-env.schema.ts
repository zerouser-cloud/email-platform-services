import {
  composeSchemas,
  TopologySchema,
  DatabaseSchema,
  RedisSchema,
  LoggingSchema,
  GrpcSchema,
  CloudFnSchema,
  type GlobalTopology,
  type DatabaseConfig,
  type RedisConfig,
  type LoggingConfig,
  type GrpcConfig,
  type CloudFnConfig,
} from '@email-platform/config';

export const SenderEnvSchema = composeSchemas(
  TopologySchema,
  DatabaseSchema,
  RedisSchema,
  LoggingSchema,
  GrpcSchema,
  CloudFnSchema,
);

export type SenderEnv = GlobalTopology &
  DatabaseConfig &
  RedisConfig &
  LoggingConfig &
  GrpcConfig &
  CloudFnConfig;
