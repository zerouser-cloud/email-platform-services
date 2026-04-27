// packages/config/src/apps/audience/env.schema.ts
//
// Per-app env schema composed via native z.object spread (D-07, no composeSchemas helper).
// Peer topology: audience → parser (audience consumes PARSER_GRPC_URL for its grpc-client).
// Infra blocks: database, rabbitmq, redis (CACHE_CONFIG_PORT slice — Phase 999.12 D-15), logging, grpc
// (per RESEARCH §Pattern 4 table; Redis after Rabbit, before Logging — sender precedent).
// Type via z.infer only — no intersection aliases (D-08).
import { z } from 'zod';
import { AudienceTopologyShape } from './topology.schema';
import { ParserTopologyShape } from '../parser/topology.schema';
import { DatabaseSchema } from '../../infra/database.schema';
import { RabbitSchema } from '../../infra/rabbitmq.schema';
import { RedisSchema } from '../../infra/redis.schema';
import { LoggingSchema } from '../../infra/logging.schema';
import { GrpcSchema } from '../../infra/grpc.schema';

export const AudienceEnvSchema = z.object({
  ...AudienceTopologyShape, // own
  ...ParserTopologyShape, // peer: audience → parser
  ...DatabaseSchema.shape,
  ...RabbitSchema.shape,
  ...RedisSchema.shape,
  ...LoggingSchema.shape,
  ...GrpcSchema.shape,
});

export type AudienceEnv = z.infer<typeof AudienceEnvSchema>;
