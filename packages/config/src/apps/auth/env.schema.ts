// packages/config/src/apps/auth/env.schema.ts
//
// Per-app env schema composed via native z.object spread (D-07, no composeSchemas helper).
// NO peer topologies — auth is the auth authority, has no upstream gRPC clients
// (RESEARCH §Pattern 2 table: "auth — no upstream gRPC clients").
// Infra blocks: database, redis (CACHE_CONFIG_PORT slice — Phase 999.12 D-15), logging, grpc
// (PATTERNS.md §Pattern 4 per-service infra table; Redis after Database, before Logging — sender precedent).
// Type via z.infer only — no intersection aliases (D-08).
import { z } from 'zod';
import { AuthTopologyShape } from './topology.schema';
import { DatabaseSchema } from '../../infra/database.schema';
import { RedisSchema } from '../../infra/redis.schema';
import { LoggingSchema } from '../../infra/logging.schema';
import { GrpcSchema } from '../../infra/grpc.schema';

export const AuthEnvSchema = z.object({
  ...AuthTopologyShape, // own (no peers — auth is leaf in the gRPC call graph)
  ...DatabaseSchema.shape,
  ...RedisSchema.shape,
  ...LoggingSchema.shape,
  ...GrpcSchema.shape,
});

export type AuthEnv = z.infer<typeof AuthEnvSchema>;
