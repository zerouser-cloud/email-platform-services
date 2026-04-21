// packages/config/src/apps/auth/topology.schema.ts
//
// Per-app static topology for the auth service (D-03, D-05, D-15).
// Terminal leaf in the module graph: imports ONLY from 'zod' — no cross-app imports,
// no infra/ imports, no identity.config.ts imports (RESEARCH §Pitfall 1).
import { z } from 'zod';

export const AuthTopologyShape = {
  AUTH_PORT: z.coerce.number().positive(),
  AUTH_GRPC_PORT: z.coerce.number().positive(),
  AUTH_GRPC_URL: z.string().min(1),
} as const;
