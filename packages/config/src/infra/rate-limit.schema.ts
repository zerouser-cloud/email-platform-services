import { z } from 'zod';

export const RateLimitSchema = z.object({
  RATE_LIMIT_BURST_TTL: z.coerce.number().positive(),
  RATE_LIMIT_BURST_LIMIT: z.coerce.number().positive(),
  RATE_LIMIT_SUSTAINED_TTL: z.coerce.number().positive(),
  RATE_LIMIT_SUSTAINED_LIMIT: z.coerce.number().positive(),
});

export type RateLimitConfig = z.infer<typeof RateLimitSchema>;
