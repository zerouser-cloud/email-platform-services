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
 *
 * Phase 999.1.9 W3 D-10 transition: retains legacy 2-generic form
 * (`<typeof AuthEnvSchema, AuthEnv>`) as Pitfall 2 escape hatch for the
 * `composeSchemas(...)`-produced `ZodObject<MergeShapes<T>>` + intersection alias
 * combination (TS 5 + Zod 4 cannot resolve `z.infer` through the generic boundary
 * here). Goes away in W4 (auth migration) when the schema moves to native
 * `z.object({...})` spread in `packages/config/src/apps/auth/env.schema.ts` —
 * audience already uses the target single-generic form.
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
