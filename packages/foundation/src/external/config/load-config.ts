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
 * @param schema - A ZodObject or ZodEffects (refined ZodObject) to validate against
 * @returns Parsed and validated config object
 */
export function loadConfig<T extends z.ZodType>(schema: T): z.infer<T> {
  const cached = cache.get(schema);
  if (cached !== undefined) return cached as z.infer<T>;

  const result = schema.parse(process.env);
  cache.set(schema, result);
  return result as z.infer<T>;
}

/**
 * Clears the schema→config cache. Intended for test suites that mutate
 * `process.env` between cases. NEVER call in production code.
 */
export function resetConfigCache(): void {
  cache.clear();
}
