import { z } from 'zod';

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
  if (cached) return cached as z.infer<T>;

  const result = schema.parse(process.env);
  cache.set(schema, result);
  return result as z.infer<T>;
}
