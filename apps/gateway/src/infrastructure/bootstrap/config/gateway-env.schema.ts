import {
  composeSchemas,
  TopologySchema,
  LoggingSchema,
  GrpcSchema,
  CorsSchema,
  RateLimitSchema,
  type GlobalTopology,
  type LoggingConfig,
  type GrpcConfig,
  type CorsConfig,
  type RateLimitConfig,
} from '@email-platform/config';

const BaseGatewayEnvSchema = composeSchemas(
  TopologySchema,
  LoggingSchema,
  GrpcSchema,
  CorsSchema,
  RateLimitSchema,
);

export const GatewayEnvSchema = BaseGatewayEnvSchema.refine(
  (data) => !(data.CORS_STRICT && data.CORS_ORIGINS === '*'),
  {
    message: 'CORS_ORIGINS cannot be "*" when CORS_STRICT is enabled. Specify explicit origins.',
    path: ['CORS_ORIGINS'],
  },
);

export type GatewayEnv = GlobalTopology & LoggingConfig & GrpcConfig & CorsConfig & RateLimitConfig;
