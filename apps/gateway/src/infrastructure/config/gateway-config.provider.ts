import type { Provider } from '@nestjs/common';
import { loadConfig } from '@email-platform/config';
import { GatewayEnvSchema, type GatewayEnv } from './gateway-env.schema';
import { GATEWAY_CONFIG } from '../../gateway.constants';

/**
 * Gateway config provider (Phase 999.11.1 D-08) — binds GATEWAY_CONFIG symbol
 * to the validated GatewayEnv value. useValue (not useFactory): loadConfig
 * is cached by schema reference (see packages/config/src/config-loader.ts),
 * eager call at module-definition time is safe.
 *
 * Cast stays until Phase 999.1 (TopologySchema static refactor per PT-04).
 */
export const gatewayConfigProvider: Provider = {
  provide: GATEWAY_CONFIG,
  useValue: loadConfig(GatewayEnvSchema) as GatewayEnv,
};
