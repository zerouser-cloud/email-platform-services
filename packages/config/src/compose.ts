import { z, type ZodRawShape } from 'zod';

type MergeShapes<T extends z.ZodObject<ZodRawShape>[]> = T extends [
  z.ZodObject<infer First>,
  ...infer Rest extends z.ZodObject<ZodRawShape>[],
]
  ? First & MergeShapes<Rest>
  : // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    {};

/**
 * Composes multiple Zod object schemas into a single flat ZodObject via shape spread.
 * Refines on input schemas are NOT preserved -- apply refines after composition.
 */
export function composeSchemas<T extends z.ZodObject<ZodRawShape>[]>(
  ...schemas: T
): z.ZodObject<MergeShapes<T>> {
  const merged: ZodRawShape = {};
  for (const schema of schemas) {
    Object.assign(merged, schema.shape);
  }
  return z.object(merged) as z.ZodObject<MergeShapes<T>>;
}
