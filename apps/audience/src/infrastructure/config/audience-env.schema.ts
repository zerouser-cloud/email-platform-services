import { z, composeSchemas, TopologySchema, DatabaseSchema, RabbitSchema, LoggingSchema, GrpcSchema } from '@email-platform/config';

export const AudienceEnvSchema: z.ZodObject<z.ZodRawShape> = composeSchemas(
  TopologySchema,
  DatabaseSchema,
  RabbitSchema,
  LoggingSchema,
  GrpcSchema,
);
