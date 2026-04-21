import { z } from 'zod';

/**
 * Module-level cache keyed by Zod schema reference identity.
 *
 * Contract: callers MUST pass the same module-level `const` schema reference
 * across invocations to hit the cache. Two distinct `composeSchemas(...)` calls
 * produce two distinct references and therefore two separate cache entries —
 * this is intentional and correct for the boot path (one schema per service).
 *
 * In unit tests that mutate `process.env` across cases, call `resetConfigCache()`
 * between cases to force re-parse. NEVER call `resetConfigCache()` in production.
 */
const cache = new Map<z.ZodType, unknown>();

/**
 * Validates process.env against the provided Zod schema.
 * Results are cached by schema reference for idempotency.
 * Works because each service passes the same module-level const schema reference.
 *
 * @typeParam T    - Zod schema type (typically `ZodObject<MergeShapes<...>>` from
 *                   `composeSchemas(...)`).
 * @typeParam TEnv - Env shape; defaults to `z.infer<T>`. Override explicitly
 *                   (`loadConfig<typeof Schema, AliasEnv>(Schema)`) when the
 *                   consumer's aliased service env type is an intersection
 *                   structurally equivalent to `z.infer<T>` but not identical
 *                   (e.g., `AuthEnv = GlobalTopology & DatabaseConfig & ...`).
 *                   Mirrors the `createConfigModule<TSchema, TEnv>` signature
 *                   and removes the need for app-side `as AuthEnv` casts at
 *                   each `main.ts` call site.
 *
 * @param schema - A ZodObject or ZodEffects (refined ZodObject) to validate against
 * @returns Parsed and validated config object, typed as `TEnv` (default `z.infer<T>`).
 */
export function loadConfig<T extends z.ZodType, TEnv = z.infer<T>>(schema: T): TEnv {
  const cached = cache.get(schema);
  if (cached !== undefined) return cached as TEnv;

  const result = schema.parse(process.env);
  cache.set(schema, result);
  return result as TEnv;
}

/**
 * Clears the schema→config cache. Intended for test suites that mutate
 * `process.env` between cases. NEVER call in production code.
 */
export function resetConfigCache(): void {
  cache.clear();
}
