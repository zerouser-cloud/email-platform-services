import { Global, Module, type DynamicModule, type Provider } from '@nestjs/common';
import { loadConfig } from '@email-platform/config';
import {
  LOGGING_CONFIG_PORT,
  PERSISTENCE_CONFIG_PORT,
  type LoggingConfig,
  type PersistenceConfig,
} from '@email-platform/foundation';
import { AuthEnvSchema, type AuthEnv } from './auth-env.schema';
import { AUTH_CONFIG } from '../../auth.constants';

/**
 * Auth config provider (Phase 999.11.1 D-08) — binds AUTH_CONFIG symbol
 * to the validated AuthEnv value. useValue (not useFactory): loadConfig
 * is cached by schema reference (see packages/config/src/config-loader.ts),
 * eager call at module-definition time is safe.
 *
 * Cast stays until Phase 999.1 (TopologySchema static refactor per PT-04).
 */
export const authConfigProvider: Provider = {
  provide: AUTH_CONFIG,
  useValue: loadConfig(AuthEnvSchema) as AuthEnv,
};

/**
 * Auth config module (Phase 999.11.1 D-10 fix, 2026-04-20) — @Global() so the
 * AUTH_CONFIG + narrow `*_CONFIG_PORT` slice providers are visible to third-party
 * dynamic modules inside foundation (`LoggingModule` → `PinoLoggerModule.forRootAsync`,
 * etc.) whose nested `forRootAsync({inject: [...]})` can't walk up to the root
 * module's providers.
 *
 * Without @Global, nestjs-pino fails at boot with
 * `UnknownDependenciesException: can't resolve Symbol(LOGGING_CONFIG_PORT)`.
 * See Plan 10 SUMMARY "Rule 3 — NestJS DI scope fix" for the root cause analysis.
 */
@Global()
@Module({})
export class AuthConfigModule {
  static forRoot(): DynamicModule {
    return {
      module: AuthConfigModule,
      providers: [
        authConfigProvider,
        {
          provide: PERSISTENCE_CONFIG_PORT,
          useFactory: (c: AuthEnv): PersistenceConfig => ({ DATABASE_URL: c.DATABASE_URL }),
          inject: [AUTH_CONFIG],
        },
        {
          provide: LOGGING_CONFIG_PORT,
          useFactory: (c: AuthEnv): LoggingConfig => ({
            LOG_LEVEL: c.LOG_LEVEL,
            LOG_FORMAT: c.LOG_FORMAT,
          }),
          inject: [AUTH_CONFIG],
        },
      ],
      exports: [AUTH_CONFIG, PERSISTENCE_CONFIG_PORT, LOGGING_CONFIG_PORT],
    };
  }
}
