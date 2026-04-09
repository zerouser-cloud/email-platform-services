import { z } from 'zod';

export const StorageSchema = z.object({
  STORAGE_PROTOCOL: z.enum(['http', 'https']),
  STORAGE_ENDPOINT: z.string().min(1),
  STORAGE_PORT: z.coerce.number(),
  STORAGE_ACCESS_KEY: z.string().min(1),
  STORAGE_SECRET_KEY: z.string().min(1),
  STORAGE_REGION: z.string().min(1),
});

export type StorageConfig = z.infer<typeof StorageSchema>;
