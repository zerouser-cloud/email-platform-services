import {
  composeSchemas,
  TopologySchema,
  DatabaseSchema,
  RabbitSchema,
  LoggingSchema,
  GrpcSchema,
  type GlobalTopology,
  type DatabaseConfig,
  type RabbitConfig,
  type LoggingConfig,
  type GrpcConfig,
} from '@email-platform/config';

export const AudienceEnvSchema = composeSchemas(
  TopologySchema,
  DatabaseSchema,
  RabbitSchema,
  LoggingSchema,
  GrpcSchema,
);

export type AudienceEnv = GlobalTopology &
  DatabaseConfig &
  RabbitConfig &
  LoggingConfig &
  GrpcConfig;
