import {
  createConfigModule,
  LOGGING_CONFIG_PORT,
  PERSISTENCE_CONFIG_PORT,
  GRPC_CLIENT_CONFIG_PORT,
  type LoggingConfig,
  type PersistenceConfig,
  type GrpcClientConfig,
} from '@email-platform/foundation';
import { AudienceEnvSchema } from '@email-platform/config';
import { AUDIENCE_CONFIG } from './audience-config.constants';

/**
 * Audience config module — factory-composed per Phase 999.1.8 (I-3.5).
 *
 * Replaces the previous hand-rolled `@Global() @Module({}) class` + `static forRoot(): DynamicModule { ... }`
 * pattern. The factory internally marks the returned module `global: true` (preserves the 999.11.1
 * Plan 10 Rule 3 fix — nested `forRootAsync({inject: [*_CONFIG_PORT]})` dynamic modules need narrow
 * ports visible at root scope).
 *
 * Narrow ports declared inline per CONTEXT D-13 (each service owns its variance).
 *
 * Phase 999.1.9 W3: schema now imported from `@email-platform/config` (packages/config/src/apps/audience/)
 * per D-07; generic args dropped per D-10; slice return-type annotations kept (Pitfall 2 mitigation).
 */
export const AudienceConfigModule = createConfigModule({
  schema: AudienceEnvSchema,
  token: AUDIENCE_CONFIG,
  narrowPorts: [
    {
      port: PERSISTENCE_CONFIG_PORT,
      slice: (c): PersistenceConfig => ({ DATABASE_URL: c.DATABASE_URL }),
    },
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
        grpcUrls: { PARSER_GRPC_URL: c.PARSER_GRPC_URL },
      }),
    },
  ],
});
