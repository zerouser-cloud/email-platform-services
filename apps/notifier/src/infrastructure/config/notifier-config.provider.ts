import { Global, Module, type DynamicModule, type Provider } from '@nestjs/common';
import { loadConfig } from '@email-platform/config';
import {
  LOGGING_CONFIG_PORT,
  STORAGE_CORE_CONFIG_PORT,
  PUBLIC_STORAGE_CONFIG_PORT,
  type LoggingConfig,
  type StorageCoreConfig,
  type PublicStorageConfig,
} from '@email-platform/foundation';
import { NotifierEnvSchema, type NotifierEnv } from './notifier-env.schema';
import { NOTIFIER_CONFIG } from '../../notifier.constants';

/**
 * Notifier config provider (Phase 999.11.1 D-08) — binds NOTIFIER_CONFIG symbol
 * to the validated NotifierEnv value. useValue (not useFactory): loadConfig
 * is cached by schema reference (see packages/config/src/config-loader.ts),
 * eager call at module-definition time is safe.
 *
 * Cast stays until Phase 999.1 (TopologySchema static refactor per PT-04).
 */
export const notifierConfigProvider: Provider = {
  provide: NOTIFIER_CONFIG,
  useValue: loadConfig(NotifierEnvSchema) as NotifierEnv,
};

/**
 * Notifier config module (Phase 999.11.1 D-10 fix, 2026-04-20) — @Global() so the
 * NOTIFIER_CONFIG + narrow `*_CONFIG_PORT` slice providers are visible to third-party
 * dynamic modules inside foundation. See Plan 10 SUMMARY "Rule 3 — NestJS DI scope
 * fix" for the root cause analysis.
 */
@Global()
@Module({})
export class NotifierConfigModule {
  static forRoot(): DynamicModule {
    return {
      module: NotifierConfigModule,
      providers: [
        notifierConfigProvider,
        {
          provide: LOGGING_CONFIG_PORT,
          useFactory: (c: NotifierEnv): LoggingConfig => ({
            LOG_LEVEL: c.LOG_LEVEL,
            LOG_FORMAT: c.LOG_FORMAT,
          }),
          inject: [NOTIFIER_CONFIG],
        },
        {
          provide: STORAGE_CORE_CONFIG_PORT,
          useFactory: (c: NotifierEnv): StorageCoreConfig => ({
            STORAGE_PROTOCOL: c.STORAGE_PROTOCOL,
            STORAGE_ENDPOINT: c.STORAGE_ENDPOINT,
            STORAGE_PORT: c.STORAGE_PORT,
            STORAGE_REGION: c.STORAGE_REGION,
            STORAGE_ACCESS_KEY: c.STORAGE_ACCESS_KEY,
            STORAGE_SECRET_KEY: c.STORAGE_SECRET_KEY,
          }),
          inject: [NOTIFIER_CONFIG],
        },
        {
          provide: PUBLIC_STORAGE_CONFIG_PORT,
          useFactory: (c: NotifierEnv): PublicStorageConfig => ({
            STORAGE_PUBLIC_URL: c.STORAGE_PUBLIC_URL,
            STORAGE_MAX_UPLOAD_BYTES: c.STORAGE_MAX_UPLOAD_BYTES,
          }),
          inject: [NOTIFIER_CONFIG],
        },
      ],
      exports: [
        NOTIFIER_CONFIG,
        LOGGING_CONFIG_PORT,
        STORAGE_CORE_CONFIG_PORT,
        PUBLIC_STORAGE_CONFIG_PORT,
      ],
    };
  }
}
