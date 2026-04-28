/**
 * Promise-based sleep utility. Lifted verbatim from Phase 24
 * `retry.policy.ts:84-86`.
 */

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
