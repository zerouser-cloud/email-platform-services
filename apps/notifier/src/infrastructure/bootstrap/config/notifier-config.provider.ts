import type { Provider } from '@nestjs/common';
import { loadConfig } from '@email-platform/config';
import { NotifierEnvSchema, type NotifierEnv } from './notifier-env.schema';
import { NOTIFIER_CONFIG } from './notifier-config.constants';

/**
 * Notifier config provider (Phase 999.11.1 D-08) — binds NOTIFIER_CONFIG symbol
 * to the validated NotifierEnv value. useValue (not useFactory): loadConfig
 * is cached by schema reference (see packages/config/src/config-loader.ts),
 * eager call at module-definition time is safe.
 *
 * Cast stays until Phase 999.1 (TopologySchema static refactor per PT-04).
 */
export const notifierConfigProvider: Provider = {
  provide: NOTIFIER_CONFIG,
  useValue: loadConfig(NotifierEnvSchema) as NotifierEnv,
};
