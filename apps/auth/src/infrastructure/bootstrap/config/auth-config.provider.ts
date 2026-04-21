import { type Provider } from '@nestjs/common';
import { loadConfig } from '@email-platform/foundation';
import { AuthEnvSchema, type AuthEnv } from './auth-env.schema';
import { AUTH_CONFIG } from './auth-config.constants';

/**
 * Auth config provider (Phase 999.11.1 D-08) — binds AUTH_CONFIG symbol
 * to the validated AuthEnv value. useValue (not useFactory): loadConfig
 * is cached by schema reference (see packages/foundation/src/external/config/load-config.ts),
 * eager call at module-definition time is safe.
 *
 * Cast stays until Phase 999.1 (TopologySchema static refactor per PT-04).
 *
 * Split from previous combined provider+module file per Phase 999.11.2 D-10
 * (one-file-per-export convention). @Global() AuthConfigModule moved to
 * sibling ./auth-config.module.ts.
 */
export const authConfigProvider: Provider = {
  provide: AUTH_CONFIG,
  useValue: loadConfig(AuthEnvSchema) as AuthEnv,
};
