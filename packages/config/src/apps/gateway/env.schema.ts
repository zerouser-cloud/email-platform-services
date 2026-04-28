import { z } from 'zod';
import { GatewayTopologyShape } from './topology.schema';

import { AuthTopologyShape } from '../auth/topology.schema';
import { SenderTopologyShape } from '../sender/topology.schema';
import { ParserTopologyShape } from '../parser/topology.schema';
import { AudienceTopologyShape } from '../audience/topology.schema';
import { NotifierTopologyShape } from '../notifier/topology.schema';
import { LoggingSchema } from '../../infra/logging.schema';
import { GrpcSchema } from '../../infra/grpc.schema';
import { CorsSchema } from '../../infra/cors.schema';
import { RateLimitSchema } from '../../infra/rate-limit.schema';
import { RedisSchema } from '../../infra/redis.schema';

// Gateway nuance (Phase 999.12 D-15): Redis spread happens INSIDE BaseGatewayEnvSchema
// (the .refine() on GatewayEnvSchema operates on the parsed object — extending the base
// object before refinement is the correct seam per PATTERNS §P-5 lines 633-651).
const BaseGatewayEnvSchema = z.object({
  ...GatewayTopologyShape,
  ...AuthTopologyShape,
  ...SenderTopologyShape,
  ...ParserTopologyShape,
  ...AudienceTopologyShape,
  ...NotifierTopologyShape,
  ...LoggingSchema.shape,
  ...GrpcSchema.shape,
  ...CorsSchema.shape,
  ...RateLimitSchema.shape,
  ...RedisSchema.shape,
});

export const GatewayEnvSchema = BaseGatewayEnvSchema.refine(
  (data) => !(data.CORS_STRICT && data.CORS_ORIGINS === '*'),
  {
    message: 'CORS_ORIGINS cannot be "*" when CORS_STRICT is enabled. Specify explicit origins.',
    path: ['CORS_ORIGINS'],
  },
);

export type GatewayEnv = z.infer<typeof GatewayEnvSchema>;
