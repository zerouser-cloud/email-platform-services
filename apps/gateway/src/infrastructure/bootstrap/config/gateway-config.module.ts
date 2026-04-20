import { Global, Module, type DynamicModule } from '@nestjs/common';
import {
  LOGGING_CONFIG_PORT,
  GRPC_CLIENT_CONFIG_PORT,
  type LoggingConfig,
  type GrpcClientConfig,
} from '@email-platform/foundation';
import { gatewayConfigProvider } from './gateway-config.provider';
import { GATEWAY_CONFIG } from './gateway-config.constants';
import type { GatewayEnv } from './gateway-env.schema';

/**
 * Gateway config module (Phase 999.11.1 D-10 fix, 2026-04-20) — @Global() so the
 * GATEWAY_CONFIG + narrow `*_CONFIG_PORT` slice providers are visible to third-party
 * dynamic modules inside foundation (`LoggingModule` → `PinoLoggerModule.forRootAsync`,
 * `ThrottlerModule.forRootAsync`, `defineGrpcClient` → `ClientsModule.registerAsync`)
 * whose nested `forRootAsync({inject: [...]})` can't walk up to the root module's
 * providers. See Plan 10 SUMMARY "Rule 3 — NestJS DI scope fix" for the root cause.
 *
 * Moved to sibling file per Phase 999.11.2 D-10 (one-file-per-export convention).
 * @Global() preserved per Phase 999.11.1 Plan 10 Rule 3 fix.
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
