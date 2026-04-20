import type { Provider } from '@nestjs/common';
import { loadConfig } from '@email-platform/config';
import { SenderEnvSchema, type SenderEnv } from './sender-env.schema';
import { SENDER_CONFIG } from '../../sender.constants';

/**
 * Sender config provider (Phase 999.11.1 D-08) — binds SENDER_CONFIG symbol
 * to the validated SenderEnv value. useValue (not useFactory): loadConfig
 * is cached by schema reference (see packages/config/src/config-loader.ts),
 * eager call at module-definition time is safe.
 *
 * Cast stays until Phase 999.1 (TopologySchema static refactor per PT-04).
 */
export const senderConfigProvider: Provider = {
  provide: SENDER_CONFIG,
  useValue: loadConfig(SenderEnvSchema) as SenderEnv,
};
