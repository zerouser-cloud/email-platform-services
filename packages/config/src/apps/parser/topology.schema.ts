// packages/config/src/apps/parser/topology.schema.ts
//
// Per-app static topology for the parser service (D-03, D-05, D-15).
// Introduced in Phase 999.1.9 W3 as a dependency of the audience canary env schema
// (audience → parser peer topology spread). Will be fully adopted by the parser service
// bootstrap in W6 — the content here is already the final shape.
// Terminal leaf in the module graph: imports ONLY from 'zod' (RESEARCH §Pitfall 1).
import { z } from 'zod';

export const ParserTopologyShape = {
  PARSER_PORT: z.coerce.number().positive(),
  PARSER_GRPC_PORT: z.coerce.number().positive(),
  PARSER_GRPC_URL: z.string().min(1),
} as const;
