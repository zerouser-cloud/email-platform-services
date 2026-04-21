import {
  createConfigModule,
  LOGGING_CONFIG_PORT,
  GRPC_CLIENT_CONFIG_PORT,
  type LoggingConfig,
  type GrpcClientConfig,
} from '@email-platform/foundation';
import { GatewayEnvSchema, type GatewayEnv } from './gateway-env.schema';
import { GATEWAY_CONFIG } from './gateway-config.constants';

/**
 * Gateway config module — factory-composed per Phase 999.1.8 (I-3.5).
 *
 * Replaces the previous hand-rolled `@Global() @Module({}) class` + `static forRoot(): DynamicModule { ... }`
 * pattern. The factory internally marks the returned module `global: true` (preserves the 999.11.1
 * Plan 10 Rule 3 fix — nested `forRootAsync({inject: [*_CONFIG_PORT]})` dynamic modules such as
 * LoggingModule / ThrottlerModule / gRPC ClientsModule need narrow ports visible at root scope).
 *
 * Narrow ports: LOGGING + GRPC_CLIENT (5 upstream URLs: AUTH / SENDER / PARSER / AUDIENCE / NOTIFIER).
 * No PERSISTENCE — gateway has no database.
 */
export const GatewayConfigModule = createConfigModule<typeof GatewayEnvSchema, GatewayEnv>({
  schema: GatewayEnvSchema,
  token: GATEWAY_CONFIG,
  narrowPorts: [
    {
      port: LOGGING_CONFIG_PORT,
      slice: (c): LoggingConfig => ({
        LOG_LEVEL: c.LOG_LEVEL,
        LOG_FORMAT: c.LOG_FORMAT,
      }),
    },
    {
      port: GRPC_CLIENT_CONFIG_PORT,
      slice: (c): GrpcClientConfig => ({
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
    },
  ],
});
