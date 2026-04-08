import { z, composeSchemas, TopologySchema, DatabaseSchema, LoggingSchema, GrpcSchema } from '@email-platform/config';

export const AuthEnvSchema: z.ZodObject<z.ZodRawShape> = composeSchemas(
  TopologySchema,
  DatabaseSchema,
  LoggingSchema,
  GrpcSchema,
);
