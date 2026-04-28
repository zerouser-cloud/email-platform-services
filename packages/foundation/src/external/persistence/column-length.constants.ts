/**
 * Generic SQL VARCHAR length conventions — orthogonal to any specific RDBMS.
 *
 * Phase 999.12.1 D-10 extraction: previously co-located with PG-specific constants
 * (PG_POOL_DEFAULTS, PG_HEALTH) in persistence.constants.ts; the misplacement
 * falsely tied generic VARCHAR semantics to PostgreSQL. Moved here to single-concern
 * file matching the principle "co-locate orthogonal generic constants in their own file"
 * (RESEARCH.md §"Anti-Patterns to Avoid"). The barrel persistence/index.ts re-exports
 * COLUMN_LENGTH from this file; consumer schemas continue importing from
 * '@email-platform/foundation' barrel transparently (no app-side changes needed).
 */
export const COLUMN_LENGTH = {
  SHORT: 50,
  MEDIUM: 100,
  DEFAULT: 255,
} as const;
