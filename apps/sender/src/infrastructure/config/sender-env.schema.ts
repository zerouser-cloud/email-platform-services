import { z, composeSchemas, TopologySchema, DatabaseSchema, RedisSchema, LoggingSchema, GrpcSchema } from '@email-platform/config';

export const SenderEnvSchema: z.ZodObject<z.ZodRawShape> = composeSchemas(
  TopologySchema,
  DatabaseSchema,
  RedisSchema,
  LoggingSchema,
  GrpcSchema,
);
