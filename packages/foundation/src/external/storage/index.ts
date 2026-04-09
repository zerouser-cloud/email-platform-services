// External storage barrel.
// Re-exports the public ReportsStorageModule facade.
// NOTE: storage-related runtime primitives are INTENTIONALLY not re-exported here —
// they live under packages/foundation/src/internal/storage/ and are reached via
// @email-platform/foundation/internal (guarded by the exports field in
// packages/foundation/package.json and the ESLint rule added in Plan 05).
export * from './reports';

// Type-only re-export: StorageHealthIndicator (carried forward from Plan 02 Rule 3 auto-fix).
// `apps/parser/src/health/health.controller.ts` and
// `apps/notifier/src/health/health.controller.ts` import this interface as a type
// to annotate the injected `*_STORAGE_HEALTH` providers. The interface lives under
// `internal/storage/storage.interfaces.ts` but is public-facing (consumer-facing
// contract for the REPORTS_STORAGE_HEALTH token), equivalent to DatabaseHealthIndicator
// which is exposed via external/persistence.
// Re-exported here as type-only so the public barrel continues to expose only the
// contract, not the primitive implementation class (which stays internal).
// This is a TYPE-ONLY export — it carries no runtime JS and cannot leak any runtime
// storage primitive values into the public barrel.
export type { StorageHealthIndicator } from '../../internal/storage';
