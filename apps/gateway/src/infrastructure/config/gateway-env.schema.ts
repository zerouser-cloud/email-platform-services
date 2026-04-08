import { z, composeSchemas, TopologySchema, LoggingSchema, GrpcSchema, CorsSchema, RateLimitSchema } from '@email-platform/config';

const BaseGatewayEnvSchema: z.ZodObject<z.ZodRawShape> = composeSchemas(
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
