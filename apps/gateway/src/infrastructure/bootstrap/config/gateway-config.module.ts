import {
  createConfigModule,
  LOGGING_CONFIG_PORT,
  GRPC_CLIENT_CONFIG_PORT,
  type LoggingConfig,
  type GrpcClientConfig,
} from '@email-platform/foundation';
import { GatewayEnvSchema } from '@email-platform/config';
import { GATEWAY_CONFIG } from './gateway-config.constants';

export const GatewayConfigModule = createConfigModule({
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
