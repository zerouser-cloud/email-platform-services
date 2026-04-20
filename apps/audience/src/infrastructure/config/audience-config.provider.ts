import { Global, Module, type DynamicModule, type Provider } from '@nestjs/common';
import { loadConfig } from '@email-platform/config';
import {
  LOGGING_CONFIG_PORT,
  PERSISTENCE_CONFIG_PORT,
  GRPC_CLIENT_CONFIG_PORT,
  type LoggingConfig,
  type PersistenceConfig,
  type GrpcClientConfig,
} from '@email-platform/foundation';
import { AudienceEnvSchema, type AudienceEnv } from './audience-env.schema';
import { AUDIENCE_CONFIG } from '../../audience.constants';

/**
 * Audience config provider (Phase 999.11.1 D-08) — binds AUDIENCE_CONFIG symbol
 * to the validated AudienceEnv value. useValue (not useFactory): loadConfig
 * is cached by schema reference (see packages/config/src/config-loader.ts),
 * eager call at module-definition time is safe.
 *
 * Cast stays until Phase 999.1 (TopologySchema static refactor per PT-04).
 */
export const audienceConfigProvider: Provider = {
  provide: AUDIENCE_CONFIG,
  useValue: loadConfig(AudienceEnvSchema) as AudienceEnv,
};

/**
 * Audience config module (Phase 999.11.1 D-10 fix, 2026-04-20) — @Global() so the
 * {SVC}_CONFIG + narrow `*_CONFIG_PORT` slice providers are visible to third-party
 * dynamic modules inside foundation (`LoggingModule` → `PinoLoggerModule.forRootAsync`,
 * `defineGrpcClient` → `ClientsModule.registerAsync`, etc.) whose nested
 * `forRootAsync({inject: [...]})` can't walk up to the root module's providers.
 *
 * Without @Global, nestjs-pino + @nestjs/microservices fail at boot with
 * `UnknownDependenciesException: can't resolve Symbol(LOGGING_CONFIG_PORT)`.
 * See Plan 10 SUMMARY "Rule 3 — NestJS DI scope fix" for the root cause analysis.
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
