export * from './sender-config.constants';
export * from './sender-config.module';
// Phase 999.1.9 W5: `sender-env.schema` removed — schema now lives in
// `@email-platform/config/apps/sender/env.schema` (re-exported via the package root).
// Consumers import `SenderEnvSchema` / `type SenderEnv` from `@email-platform/config`.
