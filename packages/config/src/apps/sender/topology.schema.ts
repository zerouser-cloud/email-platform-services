// packages/config/src/apps/sender/topology.schema.ts
//
// Per-app static topology for the sender service (D-03, D-05, D-15).
// Terminal leaf in the module graph: imports ONLY from 'zod' — no cross-app imports,
// no infra/ imports, no identity.config.ts imports (RESEARCH §Pitfall 1).
import { z } from 'zod';

// SENDER_PORT field dropped в Phase 999.18.2 Wave 2 per ADR-001 §Decision (c.2) —
// sender = gRPC-only service; HTTP server removed from main.ts.
export const SenderTopologyShape = {
  SENDER_GRPC_PORT: z.coerce.number().positive(),
  SENDER_GRPC_URL: z.string().min(1),
} as const;
