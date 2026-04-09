// External storage barrel.
// Re-exports the public ReportsStorageModule facade.
export * from './reports';

// === Type-only re-export: StorageHealthIndicator (Rule 3 auto-fix) ===
// `apps/parser/src/health/health.controller.ts` and
// `apps/notifier/src/health/health.controller.ts` import `StorageHealthIndicator`
// as a type to annotate the injected `*_STORAGE_HEALTH` providers. The interface
// lives under `internal/storage/storage.interfaces.ts` but is public-facing
// (consumer-facing contract for the REPORTS_STORAGE_HEALTH token), equivalent to
// DatabaseHealthIndicator which is exposed via external/persistence.
// Re-exported here as type-only so the public barrel continues to expose only the
// contract, not the primitive implementation (S3HealthIndicator stays internal).
// A later plan may relocate this interface to external/storage/ proper.
export type { StorageHealthIndicator } from '../../internal/storage';

// === TEMPORARY Plan 04 compat shim — DELETE in Plan 04 Task 1 ===
// `apps/parser/src/infrastructure/storage/parser-storage.module.ts` currently imports
// `BucketStorageModule` from the top-level `@email-platform/foundation` barrel.
// Plan 04 switches that import to `@email-platform/foundation/internal` (which requires
// the package.json `exports` field + tsconfig upgrade landing in Plan 03 first).
// Until Plan 04 runs, this re-export keeps parser-storage.module.ts building.
// REMOVE this block in Plan 04 Task 1 in the same commit that rewrites parser-storage.module.ts.
export { BucketStorageModule } from '../../internal/storage';
// === END Plan 04 compat shim ===
