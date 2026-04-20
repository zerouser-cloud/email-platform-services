import { Global, Module, type DynamicModule } from '@nestjs/common';
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
import { SENDER_CONFIG } from './sender-config.constants';
import { senderConfigProvider } from './sender-config.provider';
import type { SenderEnv } from './sender-env.schema';

/**
 * Sender config module (Phase 999.11.1 D-10 fix, 2026-04-20) — @Global() so the
 * SENDER_CONFIG + narrow `*_CONFIG_PORT` slice providers are visible to third-party
 * dynamic modules inside foundation. See Plan 10 SUMMARY "Rule 3 — NestJS DI scope
 * fix" for the root cause analysis.
 *
 * Phase 999.11.2 D-10: extracted into its own file (sibling of provider) per
 * one-file-per-export convention established by Plan 01.
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
