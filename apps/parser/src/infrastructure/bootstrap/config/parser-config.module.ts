import {
  createConfigModule,
  LOGGING_CONFIG_PORT,
  PERSISTENCE_CONFIG_PORT,
  CACHE_CONFIG_PORT,
  STORAGE_CORE_CONFIG_PORT,
  PUBLIC_STORAGE_CONFIG_PORT,
  GRPC_CLIENT_CONFIG_PORT,
  type LoggingConfig,
  type PersistenceConfig,
  type CacheConfig,
  type StorageCoreConfig,
  type PublicStorageConfig,
  type GrpcClientConfig,
} from '@email-platform/foundation';
import { ParserEnvSchema } from '@email-platform/config';
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
 *
 * Phase 999.1.9 W6: schema now imported from `@email-platform/config` (packages/config/src/apps/parser/)
 * per D-07; generic args dropped per D-10; slice return-type annotations kept (Pitfall 2 mitigation).
 * Target single-generic `createConfigModule({...})` form — removes one Pitfall 2 escape hatch
 * (was legacy 2-generic `<typeof ParserEnvSchema, ParserEnv>` in W3-interim state). Native
 * `z.object({...Shape})` spread in the new schema resolves `z.infer` through the generic boundary
 * cleanly (audience W3 + auth W4 + sender W5 pattern extended here to the highest-narrow-port shape).
 */
export const ParserConfigModule = createConfigModule({
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
      port: CACHE_CONFIG_PORT,
      slice: (c): CacheConfig => ({ REDIS_URL: c.REDIS_URL }),
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
