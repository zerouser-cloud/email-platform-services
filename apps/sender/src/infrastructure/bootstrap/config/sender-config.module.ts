import {
  createConfigModule,
  LOGGING_CONFIG_PORT,
  PERSISTENCE_CONFIG_PORT,
  CACHE_CONFIG_PORT,
  GRPC_CLIENT_CONFIG_PORT,
  type LoggingConfig,
  type PersistenceConfig,
  type CacheConfig,
  type GrpcClientConfig,
} from '@email-platform/foundation';
import { SenderEnvSchema, type SenderEnv } from './sender-env.schema';
import { SENDER_CONFIG } from './sender-config.constants';

/**
 * Sender config module — factory-composed per Phase 999.1.8 (I-3.5).
 *
 * Replaces the previous hand-rolled `@Global() @Module({}) class` + `static forRoot(): DynamicModule { ... }`
 * pattern. The factory internally marks the returned module `global: true` (preserves the 999.11.1
 * Plan 10 Rule 3 fix — nested `forRootAsync({inject: [*_CONFIG_PORT]})` dynamic modules need narrow
 * ports visible at root scope).
 *
 * Narrow ports: PERSISTENCE + LOGGING + CACHE (REDIS_URL) + GRPC_CLIENT (1 upstream URL:
 * AUDIENCE_GRPC_URL). Sender is the only service that currently binds CACHE_CONFIG_PORT.
 *
 * Phase 999.1.9 W3 D-10 transition: retains legacy 2-generic form
 * (`<typeof SenderEnvSchema, SenderEnv>`) as Pitfall 2 escape hatch for the
 * `composeSchemas(...)`-produced schema + intersection alias combination.
 * Goes away in W7 (sender migration) when the schema moves to native
 * `z.object({...})` spread in `packages/config/src/apps/sender/env.schema.ts`.
 */
export const SenderConfigModule = createConfigModule<typeof SenderEnvSchema, SenderEnv>({
  schema: SenderEnvSchema,
  token: SENDER_CONFIG,
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
      port: GRPC_CLIENT_CONFIG_PORT,
      slice: (c): GrpcClientConfig => ({
        PROTO_DIR: c.PROTO_DIR,
        GRPC_DEADLINE_MS: c.GRPC_DEADLINE_MS,
        grpcUrls: { AUDIENCE_GRPC_URL: c.AUDIENCE_GRPC_URL },
      }),
    },
  ],
});
