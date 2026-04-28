// packages/config/src/apps/notifier/env.schema.ts
//
// Per-app env schema composed via native z.object spread (D-07, no composeSchemas helper).
// NO peer topologies — notifier is a terminal event consumer with no upstream gRPC
// clients (RESEARCH §Pattern 2 table: "notifier — no upstream gRPC clients").
// Infra blocks: rabbitmq, storage, redis (CACHE_CONFIG_PORT slice — Phase 999.12 D-15), logging, grpc
// + notifier-owned external-apis schema (Telegram — per PATTERNS.md §Pattern 4 / §Pattern 5, D-21).
// Redis insertion after Storage, before Logging (sender precedent).
// Type via z.infer only — no intersection aliases (D-08).
import { z } from 'zod';
import { NotifierTopologyShape } from './topology.schema';
import { TelegramSchema } from './external-apis.schema';
import { RabbitSchema } from '../../infra/rabbitmq.schema';
import { StorageSchema } from '../../infra/storage.schema';
import { RedisSchema } from '../../infra/redis.schema';
import { LoggingSchema } from '../../infra/logging.schema';
import { GrpcSchema } from '../../infra/grpc.schema';

export const NotifierEnvSchema = z.object({
  ...NotifierTopologyShape, // own (no peers — notifier is a leaf event consumer)
  ...RabbitSchema.shape,
  ...StorageSchema.shape,
  ...RedisSchema.shape,
  ...LoggingSchema.shape,
  ...GrpcSchema.shape,
  ...TelegramSchema.shape,
});

export type NotifierEnv = z.infer<typeof NotifierEnvSchema>;
