import { z } from 'zod';

export const DatabaseSchema = z.object({
  DATABASE_URL: z.string().url(),
});

export type DatabaseConfig = z.infer<typeof DatabaseSchema>;
