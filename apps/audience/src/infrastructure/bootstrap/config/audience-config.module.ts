import { Global, Module, type DynamicModule } from '@nestjs/common';
import {
  LOGGING_CONFIG_PORT,
  PERSISTENCE_CONFIG_PORT,
  GRPC_CLIENT_CONFIG_PORT,
  type LoggingConfig,
  type PersistenceConfig,
  type GrpcClientConfig,
} from '@email-platform/foundation';
import { audienceConfigProvider } from './audience-config.provider';
import { AUDIENCE_CONFIG } from './audience-config.constants';
import type { AudienceEnv } from './audience-env.schema';

/**
 * Audience config module (Phase 999.11.1 D-10 fix, 2026-04-20) — @Global() so the
 * AUDIENCE_CONFIG + narrow `*_CONFIG_PORT` slice providers are visible to third-party
 * dynamic modules inside foundation (`LoggingModule` → `PinoLoggerModule.forRootAsync`,
 * `defineGrpcClient` → `ClientsModule.registerAsync`, etc.) whose nested
 * `forRootAsync({inject: [...]})` can't walk up to the root module's providers.
 *
 * Moved to sibling file per Phase 999.11.2 D-10 (one-file-per-export convention).
 * @Global() preserved per Phase 999.11.1 Plan 10 Rule 3 fix.
 */
@Global()
@Module({})
export class AudienceConfigModule {
  static forRoot(): DynamicModule {
    return {
      module: AudienceConfigModule,
      providers: [
        audienceConfigProvider,
        {
          provide: PERSISTENCE_CONFIG_PORT,
          useFactory: (c: AudienceEnv): PersistenceConfig => ({ DATABASE_URL: c.DATABASE_URL }),
          inject: [AUDIENCE_CONFIG],
        },
        {
          provide: LOGGING_CONFIG_PORT,
          useFactory: (c: AudienceEnv): LoggingConfig => ({
            LOG_LEVEL: c.LOG_LEVEL,
            LOG_FORMAT: c.LOG_FORMAT,
          }),
          inject: [AUDIENCE_CONFIG],
        },
        {
          provide: GRPC_CLIENT_CONFIG_PORT,
          useFactory: (c: AudienceEnv): GrpcClientConfig => ({
            PROTO_DIR: c.PROTO_DIR,
            GRPC_DEADLINE_MS: c.GRPC_DEADLINE_MS,
            grpcUrls: { PARSER_GRPC_URL: c.PARSER_GRPC_URL },
          }),
          inject: [AUDIENCE_CONFIG],
        },
      ],
      exports: [
        AUDIENCE_CONFIG,
        PERSISTENCE_CONFIG_PORT,
        LOGGING_CONFIG_PORT,
        GRPC_CLIENT_CONFIG_PORT,
      ],
    };
  }
}
