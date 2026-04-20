import type { Provider } from '@nestjs/common';
import { loadConfig } from '@email-platform/config';
import { AuthEnvSchema, type AuthEnv } from './auth-env.schema';
import { AUTH_CONFIG } from '../../auth.constants';

/**
 * Auth config provider (Phase 999.11.1 D-08) — binds AUTH_CONFIG symbol
 * to the validated AuthEnv value. useValue (not useFactory): loadConfig
 * is cached by schema reference (see packages/config/src/config-loader.ts),
 * eager call at module-definition time is safe.
 *
 * Cast stays until Phase 999.1 (TopologySchema static refactor per PT-04).
 */
export const authConfigProvider: Provider = {
  provide: AUTH_CONFIG,
  useValue: loadConfig(AuthEnvSchema) as AuthEnv,
};
