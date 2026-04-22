export * from './auth-config.constants';
export * from './auth-config.module';
// Phase 999.1.9 W4: `auth-env.schema` removed — schema now lives in
// `@email-platform/config/apps/auth/env.schema` (re-exported via the package root).
// Consumers import `AuthEnvSchema` / `type AuthEnv` from `@email-platform/config`.
