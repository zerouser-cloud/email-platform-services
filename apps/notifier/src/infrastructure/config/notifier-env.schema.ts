import {
  composeSchemas,
  TopologySchema,
  RabbitSchema,
  StorageSchema,
  LoggingSchema,
  type GlobalTopology,
  type RabbitConfig,
  type StorageConfig,
  type LoggingConfig,
} from '@email-platform/config';

export const NotifierEnvSchema = composeSchemas(
  TopologySchema,
  RabbitSchema,
  StorageSchema,
  LoggingSchema,
);

export type NotifierEnv = GlobalTopology & RabbitConfig & StorageConfig & LoggingConfig;
