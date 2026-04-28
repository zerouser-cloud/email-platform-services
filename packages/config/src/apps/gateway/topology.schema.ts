// packages/config/src/apps/gateway/topology.schema.ts
//
// Per-app static topology for the gateway service (D-03, D-05, D-15).
// Gateway is the REST facade and HAS NO gRPC server — so the topology contains
// ONLY `GATEWAY_PORT` (HTTP). Unlike the 5 gRPC services (auth / sender / parser /
// audience / notifier) which each declare `{SVC}_PORT + {SVC}_GRPC_PORT +
// {SVC}_GRPC_URL`, gateway intentionally omits GRPC_PORT (no gRPC server to bind)
// and omits GRPC_URL (gateway never calls itself — upstream clients live on peer
// topology spreads in env.schema.ts).
//
// Terminal leaf in the module graph: imports ONLY from 'zod' — no cross-app
// imports, no infra/ imports, no identity.config.ts imports (RESEARCH §Pitfall 1).
import { z } from 'zod';

export const GatewayTopologyShape = {
  GATEWAY_PORT: z.coerce.number().positive(),
  // Intentionally NO gRPC server port / URL here — gateway is HTTP-only.
  // Upstream gRPC client URLs live on peer topology spreads in env.schema.ts.
} as const;
