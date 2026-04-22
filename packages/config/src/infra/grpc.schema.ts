import { z } from 'zod';

export const GrpcSchema = z.object({
  GRPC_DEADLINE_MS: z.coerce.number().positive(),
  PROTO_DIR: z.string().min(1),
});

export type GrpcConfig = z.infer<typeof GrpcSchema>;
