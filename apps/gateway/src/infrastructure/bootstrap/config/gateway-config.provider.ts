import { type Provider } from '@nestjs/common';
import { loadConfig } from '@email-platform/foundation';
import { GatewayEnvSchema, type GatewayEnv } from './gateway-env.schema';
import { GATEWAY_CONFIG } from './gateway-config.constants';

/**
 * Gateway config provider (Phase 999.11.1 D-08) — binds GATEWAY_CONFIG symbol
 * to the validated GatewayEnv value. useValue (not useFactory): loadConfig
 * is cached by schema reference (see packages/foundation/src/external/config/load-config.ts),
 * eager call at module-definition time is safe.
 *
 * Cast stays until Phase 999.1 (TopologySchema static refactor per PT-04).
 *
 * Split from previous combined provider+module file per Phase 999.11.2 D-10
 * (one-file-per-export convention). @Global() GatewayConfigModule moved to
 * sibling ./gateway-config.module.ts.
 */
export const gatewayConfigProvider: Provider = {
  provide: GATEWAY_CONFIG,
  useValue: loadConfig(GatewayEnvSchema) as GatewayEnv,
};
