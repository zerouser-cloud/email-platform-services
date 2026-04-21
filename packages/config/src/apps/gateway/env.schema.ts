// packages/config/src/apps/gateway/env.schema.ts
//
// Per-app env schema composed via native z.object spread (D-07, no composeSchemas helper).
//
// Gateway peer topologies: ALL 5 downstream services (auth, sender, parser,
// audience, notifier) — gateway is the single ingress REST facade and calls
// every domain service via gRPC. Spreading all 5 peer topologies is mandatory
// per RESEARCH §Pitfall 4 (the gateway peer-explosion checklist). Missing any
// one of them would cause a TypeScript error downstream in
// `apps/gateway/.../gateway-config.module.ts` where the narrow-port slice reads
// `c.{SVC}_GRPC_URL` for all 5 services.
//
// Infra blocks: Logging + Grpc (for client-side PROTO_DIR + GRPC_DEADLINE_MS) +
// Cors + RateLimit. No Database / Rabbit / Redis / Storage — gateway has no
// persistence of any kind (it translates HTTP requests into upstream gRPC calls).
//
// Cross-field refinement preserved from the legacy gateway-env.schema.ts
// (RESEARCH Assumption A8, T-999.1.9-17 tampering mitigation): when
// `CORS_STRICT=true`, `CORS_ORIGINS='*'` is rejected to prevent an accidental
// open-CORS posture in "strict" mode. The refine predicate / message / path are
// copied verbatim from the legacy file — no semantic drift.
//
// Type via z.infer only — no intersection aliases (D-08).
import { z } from 'zod';
import { GatewayTopologyShape } from './topology.schema';
// Gateway calls ALL 5 downstream services — spread all 5 peer topologies:
import { AuthTopologyShape } from '../auth/topology.schema';
import { SenderTopologyShape } from '../sender/topology.schema';
import { ParserTopologyShape } from '../parser/topology.schema';
import { AudienceTopologyShape } from '../audience/topology.schema';
import { NotifierTopologyShape } from '../notifier/topology.schema';
import { LoggingSchema } from '../../infra/logging.schema';
import { GrpcSchema } from '../../infra/grpc.schema';
import { CorsSchema } from '../../infra/cors.schema';
import { RateLimitSchema } from '../../infra/rate-limit.schema';

const BaseGatewayEnvSchema = z.object({
  ...GatewayTopologyShape, // own (HTTP port only — no gRPC server)
  ...AuthTopologyShape, // peer 1/5: gateway → auth
  ...SenderTopologyShape, // peer 2/5: gateway → sender
  ...ParserTopologyShape, // peer 3/5: gateway → parser
  ...AudienceTopologyShape, // peer 4/5: gateway → audience
  ...NotifierTopologyShape, // peer 5/5: gateway → notifier
  ...LoggingSchema.shape,
  ...GrpcSchema.shape,
  ...CorsSchema.shape,
  ...RateLimitSchema.shape,
});

export const GatewayEnvSchema = BaseGatewayEnvSchema.refine(
  (data) => !(data.CORS_STRICT && data.CORS_ORIGINS === '*'),
  {
    message: 'CORS_ORIGINS cannot be "*" when CORS_STRICT is enabled. Specify explicit origins.',
    path: ['CORS_ORIGINS'],
  },
);

export type GatewayEnv = z.infer<typeof GatewayEnvSchema>;
