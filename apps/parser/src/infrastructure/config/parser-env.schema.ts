import { z, composeSchemas, TopologySchema, DatabaseSchema, StorageSchema, LoggingSchema, GrpcSchema } from '@email-platform/config';

export const ParserEnvSchema: z.ZodObject<z.ZodRawShape> = composeSchemas(
  TopologySchema,
  DatabaseSchema,
  StorageSchema,
  LoggingSchema,
  GrpcSchema,
);
