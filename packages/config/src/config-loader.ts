import { GlobalEnvSchema, GlobalEnv } from './env-schema';

let cachedConfig: GlobalEnv | null = null;

/**
 * Pure validator for process.env against Zod GlobalEnvSchema.
 *
 * Environment variables must be injected by the platform:
 * - Local dev: `node --env-file=.env` (Node.js 20+ native)
 * - Docker: `env_file` in docker-compose.yml
 * - CI/Prod: platform-level env injection
 *
 * This function NEVER loads files — it only validates what's already in process.env.
 *
 * @returns Safely validated GlobalEnv (topology + infrastructure), cached after first execution.
 */
export function loadGlobalConfig(): GlobalEnv {
  if (cachedConfig) return cachedConfig;

  cachedConfig = GlobalEnvSchema.parse(process.env) as unknown as GlobalEnv;
  return cachedConfig;
}
