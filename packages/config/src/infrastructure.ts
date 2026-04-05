import { z } from 'zod';

export const InfrastructureSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().min(1),
  RABBITMQ_URL: z.string().min(1),
  STORAGE_ENDPOINT: z.string().min(1),
  STORAGE_PORT: z.coerce.number(),
  STORAGE_ACCESS_KEY: z.string().min(1),
  STORAGE_SECRET_KEY: z.string().min(1),
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_REGION: z.string().min(1),
});

export type InfrastructureConfig = z.infer<typeof InfrastructureSchema>;
