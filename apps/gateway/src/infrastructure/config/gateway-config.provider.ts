import { Global, Module, type DynamicModule, type Provider } from '@nestjs/common';
import { loadConfig } from '@email-platform/config';
import {
  LOGGING_CONFIG_PORT,
  GRPC_CLIENT_CONFIG_PORT,
  type LoggingConfig,
  type GrpcClientConfig,
} from '@email-platform/foundation';
import { GatewayEnvSchema, type GatewayEnv } from './gateway-env.schema';
import { GATEWAY_CONFIG } from '../../gateway.constants';

/**
 * Gateway config provider (Phase 999.11.1 D-08) — binds GATEWAY_CONFIG symbol
 * to the validated GatewayEnv value. useValue (not useFactory): loadConfig
 * is cached by schema reference (see packages/config/src/config-loader.ts),
 * eager call at module-definition time is safe.
 *
 * Cast stays until Phase 999.1 (TopologySchema static refactor per PT-04).
 */
export const gatewayConfigProvider: Provider = {
  provide: GATEWAY_CONFIG,
  useValue: loadConfig(GatewayEnvSchema) as GatewayEnv,
};

/**
 * Gateway config module (Phase 999.11.1 D-10 fix, 2026-04-20) — @Global() so the
 * GATEWAY_CONFIG + narrow `*_CONFIG_PORT` slice providers are visible to third-party
 * dynamic modules inside foundation (`LoggingModule` → `PinoLoggerModule.forRootAsync`,
 * `ThrottlerModule.forRootAsync`, `defineGrpcClient` → `ClientsModule.registerAsync`)
 * whose nested `forRootAsync({inject: [...]})` can't walk up to the root module's
 * providers. See Plan 10 SUMMARY "Rule 3 — NestJS DI scope fix" for the root cause.
 */
@Global()
@Module({})
export class GatewayConfigModule {
  static forRoot(): DynamicModule {
    return {
      module: GatewayConfigModule,
      providers: [
        gatewayConfigProvider,
        {
          provide: LOGGING_CONFIG_PORT,
          useFactory: (c: GatewayEnv): LoggingConfig => ({
            LOG_LEVEL: c.LOG_LEVEL,
            LOG_FORMAT: c.LOG_FORMAT,
          }),
          inject: [GATEWAY_CONFIG],
        },
        {
          provide: GRPC_CLIENT_CONFIG_PORT,
          useFactory: (c: GatewayEnv): GrpcClientConfig => ({
            PROTO_DIR: c.PROTO_DIR,
            GRPC_DEADLINE_MS: c.GRPC_DEADLINE_MS,
            grpcUrls: {
              AUTH_GRPC_URL: c.AUTH_GRPC_URL,
              SENDER_GRPC_URL: c.SENDER_GRPC_URL,
              PARSER_GRPC_URL: c.PARSER_GRPC_URL,
              AUDIENCE_GRPC_URL: c.AUDIENCE_GRPC_URL,
              NOTIFIER_GRPC_URL: c.NOTIFIER_GRPC_URL,
            },
          }),
          inject: [GATEWAY_CONFIG],
        },
      ],
      exports: [GATEWAY_CONFIG, LOGGING_CONFIG_PORT, GRPC_CLIENT_CONFIG_PORT],
    };
  }
}
