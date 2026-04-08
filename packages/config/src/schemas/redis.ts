import { z } from 'zod';

export const RedisSchema = z.object({
  REDIS_URL: z.string().min(1),
});

export type RedisConfig = z.infer<typeof RedisSchema>;
