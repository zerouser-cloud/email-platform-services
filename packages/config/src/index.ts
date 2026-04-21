// --- Legacy exports (preserved until Wave 9 cleanup) ---
export * from './topology';
export * from './schemas';
export * from './compose';
export * from './env-constants';
export * from './env-schema';
export * from './catalog/types';
export * from './catalog/define-service';
export * from './catalog/services';

// --- New per-app barrels (Phase 999.1.9 W1 — populated in W3-W8) ---
export * from './apps/audience';
export * from './apps/auth';
export * from './apps/sender';
export * from './apps/parser';
export * from './apps/gateway';
export * from './apps/notifier';
