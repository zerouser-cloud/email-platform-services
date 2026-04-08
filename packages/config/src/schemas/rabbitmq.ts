import { z } from 'zod';

export const RabbitSchema = z.object({
  RABBITMQ_URL: z.string().min(1),
});

export type RabbitConfig = z.infer<typeof RabbitSchema>;
