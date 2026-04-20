import type { Provider } from '@nestjs/common';
import { loadConfig } from '@email-platform/config';
import { AudienceEnvSchema, type AudienceEnv } from './audience-env.schema';
import { AUDIENCE_CONFIG } from '../../audience.constants';

/**
 * Audience config provider (Phase 999.11.1 D-08) — binds AUDIENCE_CONFIG symbol
 * to the validated AudienceEnv value. useValue (not useFactory): loadConfig
 * is cached by schema reference (see packages/config/src/config-loader.ts),
 * eager call at module-definition time is safe.
 *
 * Cast stays until Phase 999.1 (TopologySchema static refactor per PT-04).
 */
export const audienceConfigProvider: Provider = {
  provide: AUDIENCE_CONFIG,
  useValue: loadConfig(AudienceEnvSchema) as AudienceEnv,
};
