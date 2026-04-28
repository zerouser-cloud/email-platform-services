export * from './parser-config.constants';
export * from './parser-config.module';
// Phase 999.1.9 W6: `parser-env.schema` removed — schema now lives in
// `@email-platform/config/apps/parser/env.schema` (re-exported via the package root).
// Consumers import `ParserEnvSchema` / `type ParserEnv` from `@email-platform/config`.
