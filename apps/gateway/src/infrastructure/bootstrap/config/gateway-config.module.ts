import {
  createConfigModule,
  LOGGING_CONFIG_PORT,
  GRPC_CLIENT_CONFIG_PORT,
  type LoggingConfig,
  type GrpcClientConfig,
} from '@email-platform/foundation';
import { GatewayEnvSchema } from '@email-platform/config';
import { GATEWAY_CONFIG } from './gateway-config.constants';

/**
 * Gateway config module — factory-composed per Phase 999.1.8 (I-3.5).
 *
 * Replaces the previous hand-rolled `@Global() @Module({}) class` + `static forRoot(): DynamicModule { ... }`
 * pattern. The factory internally marks the returned module `global: true` (preserves the 999.11.1
 * Plan 10 Rule 3 fix — nested `forRootAsync({inject: [*_CONFIG_PORT]})` dynamic modules such as
 * LoggingModule / ThrottlerModule / gRPC ClientsModule need narrow ports visible at root scope).
 *
 * Narrow ports: LOGGING + GRPC_CLIENT (5 upstream URLs: AUTH / SENDER / PARSER / AUDIENCE / NOTIFIER).
 * No PERSISTENCE — gateway has no database.
 *
 * Phase 999.1.9 W7: schema now imported from `@email-platform/config` (packages/config/src/apps/gateway/)
 * per D-07; generic args dropped per D-10; slice return-type annotations kept (Pitfall 2 mitigation).
 * Target single-generic `createConfigModule({...})` form — removes one Pitfall 2 escape hatch
 * (was legacy 2-generic `<typeof GatewayEnvSchema, GatewayEnv>` in W3-W6 interim state). Gateway's
 * `.refine(...)` wrapper on top of the native `z.object({...})` spread in the new schema resolves
 * `z.infer` through the generic boundary cleanly (audience W3 + auth W4 + sender W5 + parser W6
 * pattern extended here to the special HTTP-only, 5-peer, refine-guarded shape).
 */
export const GatewayConfigModule = createConfigModule({
  schema: GatewayEnvSchema,
  token: GATEWAY_CONFIG,
  narrowPorts: [
    {
      port: LOGGING_CONFIG_PORT,
      slice: (c): LoggingConfig => ({
        LOG_LEVEL: c.LOG_LEVEL,
        LOG_FORMAT: c.LOG_FORMAT,
      }),
    },
    {
      port: GRPC_CLIENT_CONFIG_PORT,
      slice: (c): GrpcClientConfig => ({
        PROTO_DIR: c.PROTO_DIR,
        GRPC_DEADLINE_MS: c.GRPC_DEADLINE_MS,
        grpcUrls: {
          AUTH_GRPC_URL: c.AUTH_GRPC_URL,
          SENDER_GRPC_URL: c.SENDER_GRPC_URL,
          PARSER_GRPC_URL: c.PARSER_GRPC_URL,
          AUDIENCE_GRPC_URL: c.AUDIENCE_GRPC_URL,
          NOTIFIER_GRPC_URL: c.NOTIFIER_GRPC_URL,
        },
      }),
    },
  ],
});
