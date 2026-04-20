import { Global, Module, type DynamicModule } from '@nestjs/common';
import {
  LOGGING_CONFIG_PORT,
  PERSISTENCE_CONFIG_PORT,
  type LoggingConfig,
  type PersistenceConfig,
} from '@email-platform/foundation';
import { authConfigProvider } from './auth-config.provider';
import { AUTH_CONFIG } from './auth-config.constants';
import type { AuthEnv } from './auth-env.schema';

/**
 * Auth config module (Phase 999.11.1 D-10 fix, 2026-04-20) — @Global() so the
 * AUTH_CONFIG + narrow `*_CONFIG_PORT` slice providers are visible to third-party
 * dynamic modules inside foundation (`LoggingModule` → `PinoLoggerModule.forRootAsync`,
 * etc.) whose nested `forRootAsync({inject: [...]})` can't walk up to the root
 * module's providers.
 *
 * Moved to sibling file per Phase 999.11.2 D-10 (one-file-per-export convention).
 * @Global() preserved per Phase 999.11.1 Plan 10 Rule 3 fix.
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
