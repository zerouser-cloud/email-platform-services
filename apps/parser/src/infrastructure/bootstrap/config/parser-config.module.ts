import {
  createConfigModule,
  LOGGING_CONFIG_PORT,
  PERSISTENCE_CONFIG_PORT,
  STORAGE_CORE_CONFIG_PORT,
  PUBLIC_STORAGE_CONFIG_PORT,
  GRPC_CLIENT_CONFIG_PORT,
  type LoggingConfig,
  type PersistenceConfig,
  type StorageCoreConfig,
  type PublicStorageConfig,
  type GrpcClientConfig,
} from '@email-platform/foundation';
import { ParserEnvSchema, type ParserEnv } from './parser-env.schema';
import { PARSER_CONFIG } from './parser-config.constants';

/**
 * Parser config module — factory-composed per Phase 999.1.8 (I-3.5).
 *
 * Replaces the previous hand-rolled `@Global() @Module({}) class` + `static forRoot(): DynamicModule { ... }`
 * pattern. The factory internally marks the returned module `global: true` (preserves the 999.11.1
 * Plan 10 Rule 3 fix — nested `forRootAsync({inject: [*_CONFIG_PORT]})` dynamic modules need narrow
 * ports visible at root scope).
 *
 * Narrow ports: PERSISTENCE + LOGGING + STORAGE_CORE + PUBLIC_STORAGE + GRPC_CLIENT (1 upstream URL:
 * NOTIFIER_GRPC_URL). Parser is the highest-narrow-port-count service in the platform.
 */
export const ParserConfigModule = createConfigModule<typeof ParserEnvSchema, ParserEnv>({
  schema: ParserEnvSchema,
  token: PARSER_CONFIG,
  narrowPorts: [
    {
      port: PERSISTENCE_CONFIG_PORT,
      slice: (c): PersistenceConfig => ({ DATABASE_URL: c.DATABASE_URL }),
    },
    {
      port: LOGGING_CONFIG_PORT,
      slice: (c): LoggingConfig => ({
        LOG_LEVEL: c.LOG_LEVEL,
        LOG_FORMAT: c.LOG_FORMAT,
      }),
    },
    {
      port: STORAGE_CORE_CONFIG_PORT,
      slice: (c): StorageCoreConfig => ({
        STORAGE_PROTOCOL: c.STORAGE_PROTOCOL,
        STORAGE_ENDPOINT: c.STORAGE_ENDPOINT,
        STORAGE_PORT: c.STORAGE_PORT,
        STORAGE_REGION: c.STORAGE_REGION,
        STORAGE_ACCESS_KEY: c.STORAGE_ACCESS_KEY,
        STORAGE_SECRET_KEY: c.STORAGE_SECRET_KEY,
      }),
    },
    {
      port: PUBLIC_STORAGE_CONFIG_PORT,
      slice: (c): PublicStorageConfig => ({
        STORAGE_PUBLIC_URL: c.STORAGE_PUBLIC_URL,
        STORAGE_MAX_UPLOAD_BYTES: c.STORAGE_MAX_UPLOAD_BYTES,
      }),
    },
    {
      port: GRPC_CLIENT_CONFIG_PORT,
      slice: (c): GrpcClientConfig => ({
        PROTO_DIR: c.PROTO_DIR,
        GRPC_DEADLINE_MS: c.GRPC_DEADLINE_MS,
        grpcUrls: { NOTIFIER_GRPC_URL: c.NOTIFIER_GRPC_URL },
      }),
    },
  ],
});
