// External storage barrel.
// Re-exports the public-facing `SharedNamespaceModule` surface (Phase 22.4).
// NOTE: storage-related runtime primitives are INTENTIONALLY not re-exported here —
// they live under packages/foundation/src/internal/storage/ and are reached via
// @email-platform/foundation/internal (guarded by the exports field in
// packages/foundation/package.json and the ESLint rule added in Plan 22.1-05).
export * from './public';

// Type-only re-export: StorageHealthIndicator (carried forward from Phase 22.1 Plan 02 Rule 3 auto-fix).
// `apps/parser/src/health/health.controller.ts` and
// `apps/notifier/src/health/health.controller.ts` import this interface as a type
// to annotate the injected `*_STORAGE_HEALTH` providers. The interface lives under
// `internal/storage/storage.interfaces.ts` but is public-facing (consumer-facing
// contract for the *_STORAGE_HEALTH token), equivalent to DatabaseHealthIndicator
// which is exposed via external/persistence.
// Re-exported here as type-only so the public barrel continues to expose only the
// contract, not the primitive implementation class (which stays internal).
// This is a TYPE-ONLY export — it carries no runtime JS and cannot leak any runtime
// storage primitive values into the public barrel.
export type { StorageHealthIndicator } from '../../internal/storage';

// Type-only re-export: PrivateStoragePort.
// Contract surface for the per-service `*_STORAGE` DI token produced by
// `PrivateStorageModule.forBucket(...)`. Consumers outside the infrastructure/
// layer (e.g. smoke controllers under test/) need the type annotation but are
// ESLint-forbidden from importing from `@email-platform/foundation/internal`.
// Re-exported here as type-only so the public barrel exposes only the contract.
export type { PrivateStoragePort } from '../../internal/storage';

// Phase 999.11.1 D-10: expose STORAGE_CORE_CONFIG_PORT + StorageCoreConfig so app
// modules can bind their per-service narrow-config slice via useFactory without
// importing from `@email-platform/foundation/internal`. The Symbol is a runtime
// value (non-type re-export); StorageCoreConfig is a shape-only type.
export { STORAGE_CORE_CONFIG_PORT } from '../../internal/storage';
export type { StorageCoreConfig } from '../../internal/storage';
