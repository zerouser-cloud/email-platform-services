// packages/config/src/apps/sender/env.schema.ts
//
// Per-app env schema composed via native z.object spread (D-07, no composeSchemas helper).
// Peer topology: sender → audience (sender consumes AUDIENCE_GRPC_URL for its grpc-client).
// Infra blocks: database, redis (CACHE_CONFIG_PORT), logging, grpc + sender-owned
// external-apis schema (CloudFn — per PATTERNS.md §Pattern 4 / §Pattern 5, D-21).
// Type via z.infer only — no intersection aliases (D-08).
import { z } from 'zod';
import { SenderTopologyShape } from './topology.schema';
import { AudienceTopologyShape } from '../audience/topology.schema';
import { CloudFnSchema } from './external-apis.schema';
import { DatabaseSchema } from '../../infra/database.schema';
import { RedisSchema } from '../../infra/redis.schema';
import { LoggingSchema } from '../../infra/logging.schema';
import { GrpcSchema } from '../../infra/grpc.schema';

export const SenderEnvSchema = z.object({
  ...SenderTopologyShape, // own
  ...AudienceTopologyShape, // peer: sender → audience (needs AUDIENCE_GRPC_URL)
  ...DatabaseSchema.shape,
  ...RedisSchema.shape,
  ...LoggingSchema.shape,
  ...GrpcSchema.shape,
  ...CloudFnSchema.shape,
});

export type SenderEnv = z.infer<typeof SenderEnvSchema>;
