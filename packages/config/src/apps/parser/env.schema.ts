// packages/config/src/apps/parser/env.schema.ts
//
// Per-app env schema composed via native z.object spread (D-07, no composeSchemas helper).
// Peer topology: parser → notifier (parser consumes NOTIFIER_GRPC_URL for its grpc-client).
// Infra blocks: database, storage, redis (CACHE_CONFIG_PORT slice — Phase 999.12 D-15), logging, grpc
// + parser-owned external-apis schema (AppStoreSpy — per PATTERNS.md §Pattern 4 / §Pattern 5, D-21).
// Redis insertion after Storage, before Logging (sender precedent).
// Type via z.infer only — no intersection aliases (D-08).
import { z } from 'zod';
import { ParserTopologyShape } from './topology.schema';
import { NotifierTopologyShape } from '../notifier/topology.schema';
import { AppStoreSpySchema } from './external-apis.schema';
import { DatabaseSchema } from '../../infra/database.schema';
import { StorageSchema } from '../../infra/storage.schema';
import { RedisSchema } from '../../infra/redis.schema';
import { LoggingSchema } from '../../infra/logging.schema';
import { GrpcSchema } from '../../infra/grpc.schema';

export const ParserEnvSchema = z.object({
  ...ParserTopologyShape, // own
  ...NotifierTopologyShape, // peer: parser → notifier (needs NOTIFIER_GRPC_URL)
  ...DatabaseSchema.shape,
  ...StorageSchema.shape,
  ...RedisSchema.shape,
  ...LoggingSchema.shape,
  ...GrpcSchema.shape,
  ...AppStoreSpySchema.shape,
});

export type ParserEnv = z.infer<typeof ParserEnvSchema>;
