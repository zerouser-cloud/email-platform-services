import {
  createConfigModule,
  LOGGING_CONFIG_PORT,
  PERSISTENCE_CONFIG_PORT,
  type LoggingConfig,
  type PersistenceConfig,
} from '@email-platform/foundation';
import { AuthEnvSchema, type AuthEnv } from './auth-env.schema';
import { AUTH_CONFIG } from './auth-config.constants';

/**
 * Auth config module — factory-composed per Phase 999.1.8 (I-3.5).
 *
 * Replaces the previous hand-rolled `@Global() @Module({}) class` + `static forRoot(): DynamicModule { ... }`
 * pattern. The factory internally marks the returned module `global: true` (preserves the 999.11.1
 * Plan 10 Rule 3 fix — nested `forRootAsync({inject: [*_CONFIG_PORT]})` dynamic modules need narrow
 * ports visible at root scope).
 *
 * Narrow ports: PERSISTENCE + LOGGING only — auth has no upstream gRPC dependencies (no GRPC_CLIENT).
 */
export const AuthConfigModule = createConfigModule<typeof AuthEnvSchema, AuthEnv>({
  schema: AuthEnvSchema,
  token: AUTH_CONFIG,
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
  ],
});
