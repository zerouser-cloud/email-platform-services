import { z, composeSchemas, TopologySchema, RabbitSchema, StorageSchema, LoggingSchema } from '@email-platform/config';

export const NotifierEnvSchema: z.ZodObject<z.ZodRawShape> = composeSchemas(
  TopologySchema,
  RabbitSchema,
  StorageSchema,
  LoggingSchema,
);
