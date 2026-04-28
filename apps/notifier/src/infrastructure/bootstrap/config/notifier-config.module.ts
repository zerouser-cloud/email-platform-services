import {
  createConfigModule,
  LOGGING_CONFIG_PORT,
  CACHE_CONFIG_PORT,
  STORAGE_CORE_CONFIG_PORT,
  PUBLIC_STORAGE_CONFIG_PORT,
  type LoggingConfig,
  type CacheConfig,
  type StorageCoreConfig,
  type PublicStorageConfig,
} from '@email-platform/foundation';
import { NotifierEnvSchema } from '@email-platform/config';
import { NOTIFIER_CONFIG } from './notifier-config.constants';

/**
 * Notifier config module — factory-composed per Phase 999.1.8 (I-3.5).
 *
 * Replaces the previous hand-rolled `@Global() @Module({}) class` + `static forRoot(): DynamicModule { ... }`
 * pattern. The factory internally marks the returned module `global: true` (preserves the 999.11.1
 * Plan 10 Rule 3 fix — nested `forRootAsync({inject: [*_CONFIG_PORT]})` dynamic modules need narrow
 * ports visible at root scope).
 *
 * Narrow ports: LOGGING + STORAGE_CORE + PUBLIC_STORAGE (no PERSISTENCE — notifier is a pure RMQ
 * consumer with no database; no GRPC_CLIENT — notifier has no upstream gRPC dependencies).
 *
 * Phase 999.1.9 W8: schema now imported from `@email-platform/config` (packages/config/src/apps/notifier/)
 * per D-07; generic args dropped per D-10; slice return-type annotations kept (Pitfall 2 mitigation).
 * Target single-generic `createConfigModule({...})` form — removes the LAST legacy Pitfall 2 escape
 * hatch (was 2-generic `<typeof NotifierEnvSchema, NotifierEnv>` through W3-W7 coexistence). Native
 * `z.object({...Shape})` spread in the new schema resolves `z.infer` through the generic boundary
 * cleanly — W8 completes the single-generic universality proof across all 6 services.
 */
export const NotifierConfigModule = createConfigModule({
  schema: NotifierEnvSchema,
  token: NOTIFIER_CONFIG,
  narrowPorts: [
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
  ],
});
