import {
  composeSchemas,
  TopologySchema,
  RabbitSchema,
  StorageSchema,
  LoggingSchema,
  GrpcSchema,
  TelegramSchema,
  type GlobalTopology,
  type RabbitConfig,
  type StorageConfig,
  type LoggingConfig,
  type GrpcConfig,
  type TelegramConfig,
} from '@email-platform/config';

export const NotifierEnvSchema = composeSchemas(
  TopologySchema,
  RabbitSchema,
  StorageSchema,
  LoggingSchema,
  GrpcSchema,
  TelegramSchema,
);

export type NotifierEnv = GlobalTopology &
  RabbitConfig &
  StorageConfig &
  LoggingConfig &
  GrpcConfig &
  TelegramConfig;
