import {
  createConfigModule,
  LOGGING_CONFIG_PORT,
  STORAGE_CORE_CONFIG_PORT,
  PUBLIC_STORAGE_CONFIG_PORT,
  type LoggingConfig,
  type StorageCoreConfig,
  type PublicStorageConfig,
} from '@email-platform/foundation';
import { NotifierEnvSchema, type NotifierEnv } from './notifier-env.schema';
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
 * Phase 999.1.9 W3 D-10 exception: notifier retains the legacy 2-generic form
 * (`<typeof NotifierEnvSchema, NotifierEnv>`) as a Pitfall 2 escape hatch. The
 * `composeSchemas(...)`-produced `z.ZodObject<MergeShapes<...>>` schema combined with
 * the 6-way intersection alias `NotifierEnv` causes TS to resolve the default
 * `TEnv = z.infer<TSchema>` to `unknown` at this particular call site (not
 * reproducible for auth/sender/parser/gateway which also use composeSchemas).
 * Passing `NotifierEnv` explicitly restores proper slice-input typing. This
 * annotation goes away in W5 (notifier migration) when the schema moves to
 * native `z.object({...})` spread in `packages/config/src/apps/notifier/env.schema.ts`.
 */
export const NotifierConfigModule = createConfigModule<typeof NotifierEnvSchema, NotifierEnv>({
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
