import { z } from 'zod';

export const CorsSchema = z.object({
  CORS_ORIGINS: z.string().min(1),
  CORS_STRICT: z.string().transform((v) => v === 'true'),
});

export type CorsConfig = z.infer<typeof CorsSchema>;
