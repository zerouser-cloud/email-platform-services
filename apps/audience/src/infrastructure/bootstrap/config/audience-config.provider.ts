import { type Provider } from '@nestjs/common';
import { loadConfig } from '@email-platform/foundation';
import { AudienceEnvSchema, type AudienceEnv } from './audience-env.schema';
import { AUDIENCE_CONFIG } from './audience-config.constants';

/**
 * Audience config provider (Phase 999.11.1 D-08) — binds AUDIENCE_CONFIG symbol
 * to the validated AudienceEnv value. useValue (not useFactory): loadConfig
 * is cached by schema reference (see packages/foundation/src/external/config/load-config.ts),
 * eager call at module-definition time is safe.
 *
 * Cast stays until Phase 999.1 (TopologySchema static refactor per PT-04).
 *
 * Split from previous combined provider+module file per Phase 999.11.2 D-10
 * (one-file-per-export convention). @Global() AudienceConfigModule moved to
 * sibling ./audience-config.module.ts.
 */
export const audienceConfigProvider: Provider = {
  provide: AUDIENCE_CONFIG,
  useValue: loadConfig(AudienceEnvSchema) as AudienceEnv,
};
