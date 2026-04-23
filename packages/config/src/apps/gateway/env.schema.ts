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
});

export const GatewayEnvSchema = BaseGatewayEnvSchema.refine(
  (data) => !(data.CORS_STRICT && data.CORS_ORIGINS === '*'),
  {
    message: 'CORS_ORIGINS cannot be "*" when CORS_STRICT is enabled. Specify explicit origins.',
    path: ['CORS_ORIGINS'],
  },
);

export type GatewayEnv = z.infer<typeof GatewayEnvSchema>;
