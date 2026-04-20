import { Global, Module, type DynamicModule, type Provider } from '@nestjs/common';
import { loadConfig } from '@email-platform/config';
import {
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
import { SENDER_CONFIG } from '../../sender.constants';

/**
 * Sender config provider (Phase 999.11.1 D-08) — binds SENDER_CONFIG symbol
 * to the validated SenderEnv value. useValue (not useFactory): loadConfig
 * is cached by schema reference (see packages/config/src/config-loader.ts),
 * eager call at module-definition time is safe.
 *
 * Cast stays until Phase 999.1 (TopologySchema static refactor per PT-04).
 */
export const senderConfigProvider: Provider = {
  provide: SENDER_CONFIG,
  useValue: loadConfig(SenderEnvSchema) as SenderEnv,
};

/**
 * Sender config module (Phase 999.11.1 D-10 fix, 2026-04-20) — @Global() so the
 * SENDER_CONFIG + narrow `*_CONFIG_PORT` slice providers are visible to third-party
 * dynamic modules inside foundation. See Plan 10 SUMMARY "Rule 3 — NestJS DI scope
 * fix" for the root cause analysis.
 */
@Global()
@Module({})
export class SenderConfigModule {
  static forRoot(): DynamicModule {
    return {
      module: SenderConfigModule,
      providers: [
        senderConfigProvider,
        {
          provide: PERSISTENCE_CONFIG_PORT,
          useFactory: (c: SenderEnv): PersistenceConfig => ({ DATABASE_URL: c.DATABASE_URL }),
          inject: [SENDER_CONFIG],
        },
        {
          provide: LOGGING_CONFIG_PORT,
          useFactory: (c: SenderEnv): LoggingConfig => ({
            LOG_LEVEL: c.LOG_LEVEL,
            LOG_FORMAT: c.LOG_FORMAT,
          }),
          inject: [SENDER_CONFIG],
        },
        {
          provide: CACHE_CONFIG_PORT,
          useFactory: (c: SenderEnv): CacheConfig => ({ REDIS_URL: c.REDIS_URL }),
          inject: [SENDER_CONFIG],
        },
        {
          provide: GRPC_CLIENT_CONFIG_PORT,
          useFactory: (c: SenderEnv): GrpcClientConfig => ({
            PROTO_DIR: c.PROTO_DIR,
            GRPC_DEADLINE_MS: c.GRPC_DEADLINE_MS,
            grpcUrls: { AUDIENCE_GRPC_URL: c.AUDIENCE_GRPC_URL },
          }),
          inject: [SENDER_CONFIG],
        },
      ],
      exports: [
        SENDER_CONFIG,
        PERSISTENCE_CONFIG_PORT,
        LOGGING_CONFIG_PORT,
        CACHE_CONFIG_PORT,
        GRPC_CLIENT_CONFIG_PORT,
      ],
    };
  }
}
