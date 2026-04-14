import {
  composeSchemas,
  TopologySchema,
  RabbitSchema,
  StorageSchema,
  LoggingSchema,
  GrpcSchema,
  type GlobalTopology,
  type RabbitConfig,
  type StorageConfig,
  type LoggingConfig,
  type GrpcConfig,
} from '@email-platform/config';

export const NotifierEnvSchema = composeSchemas(
  TopologySchema,
  RabbitSchema,
  StorageSchema,
  LoggingSchema,
  GrpcSchema,
);

export type NotifierEnv = GlobalTopology &
  RabbitConfig &
  StorageConfig &
  LoggingConfig &
  GrpcConfig;
