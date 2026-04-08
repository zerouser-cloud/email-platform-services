import {
  composeSchemas,
  TopologySchema,
  DatabaseSchema,
  StorageSchema,
  LoggingSchema,
  GrpcSchema,
  type GlobalTopology,
  type DatabaseConfig,
  type StorageConfig,
  type LoggingConfig,
  type GrpcConfig,
} from '@email-platform/config';

export const ParserEnvSchema = composeSchemas(
  TopologySchema,
  DatabaseSchema,
  StorageSchema,
  LoggingSchema,
  GrpcSchema,
);

export type ParserEnv = GlobalTopology &
  DatabaseConfig &
  StorageConfig &
  LoggingConfig &
  GrpcConfig;
