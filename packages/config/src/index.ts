// --- Legacy exports (preserved until Wave 9 cleanup) ---
export * from './topology';
export * from './schemas';
export * from './compose';
export * from './env-constants';
export * from './env-schema';
export * from './catalog/types';
export * from './catalog/define-service';
export * from './catalog/services';

// --- New identity types (Phase 999.1.9 W3 — additive, type-only) ---
// W3 intentionally re-exports ONLY types from ./service (not the new `defineService`
// function) to avoid collision with the legacy `defineService` re-export from
// './catalog/define-service' above. Per-app `identity.config.ts` files import the new
// factory via deep relative path (`../../service`) during W3-W8. W9 cleanup will remove
// the legacy catalog and switch this to `export * from './service'`.
export type { GrpcServiceIdentity, ServiceIdentity } from './service';

// --- New per-app barrels (Phase 999.1.9 W1 — populated in W3-W8) ---
export * from './apps/audience';
export * from './apps/auth';
export * from './apps/sender';
export * from './apps/parser';
export * from './apps/gateway';
export * from './apps/notifier';
