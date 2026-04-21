export { NOTIFIER_CONFIG } from './notifier-config.constants';
export { NotifierConfigModule } from './notifier-config.module';
// Phase 999.1.9 W8: `notifier-env.schema` removed — schema now lives in
// `@email-platform/config/apps/notifier/env.schema` (re-exported via the package root).
// Consumers import `NotifierEnvSchema` / `type NotifierEnv` from `@email-platform/config`.
