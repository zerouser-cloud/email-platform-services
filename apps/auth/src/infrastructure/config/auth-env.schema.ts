import {
  composeSchemas,
  TopologySchema,
  DatabaseSchema,
  LoggingSchema,
  GrpcSchema,
  type GlobalTopology,
  type DatabaseConfig,
  type LoggingConfig,
  type GrpcConfig,
} from '@email-platform/config';

export const AuthEnvSchema = composeSchemas(
  TopologySchema,
  DatabaseSchema,
  LoggingSchema,
  GrpcSchema,
);

export type AuthEnv = GlobalTopology & DatabaseConfig & LoggingConfig & GrpcConfig;
