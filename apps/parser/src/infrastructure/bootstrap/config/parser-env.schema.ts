import {
  composeSchemas,
  TopologySchema,
  DatabaseSchema,
  StorageSchema,
  LoggingSchema,
  GrpcSchema,
  AppStoreSpySchema,
  type GlobalTopology,
  type DatabaseConfig,
  type StorageConfig,
  type LoggingConfig,
  type GrpcConfig,
  type AppStoreSpyConfig,
} from '@email-platform/config';

export const ParserEnvSchema = composeSchemas(
  TopologySchema,
  DatabaseSchema,
  StorageSchema,
  LoggingSchema,
  GrpcSchema,
  AppStoreSpySchema,
);

export type ParserEnv = GlobalTopology &
  DatabaseConfig &
  StorageConfig &
  LoggingConfig &
  GrpcConfig &
  AppStoreSpyConfig;
