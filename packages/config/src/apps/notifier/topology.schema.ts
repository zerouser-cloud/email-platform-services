// packages/config/src/apps/notifier/topology.schema.ts
//
// Per-app static topology for the notifier service (D-03, D-05, D-15).
// Introduced in Phase 999.1.9 W6 as a dependency of the parser env schema
// (parser → notifier peer topology spread — parser consumes NOTIFIER_GRPC_URL).
// Mirrors the W3 pattern: the parser topology stub was seeded in W3 because
// audience needed it for peer spread; here notifier topology is seeded in W6
// because parser needs it for peer spread. Will be fully adopted by the
// notifier service bootstrap in W8 — the content here is already the final shape.
// Terminal leaf in the module graph: imports ONLY from 'zod' (RESEARCH §Pitfall 1).
import { z } from 'zod';

export const NotifierTopologyShape = {
  NOTIFIER_PORT: z.coerce.number().positive(),
  NOTIFIER_GRPC_PORT: z.coerce.number().positive(),
  NOTIFIER_GRPC_URL: z.string().min(1),
} as const;
