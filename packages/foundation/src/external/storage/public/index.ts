// Phase 22.4 public storage surface.
// `public-storage.module.ts` is intentionally NOT re-exported here —
// its physical deletion happens in Plan 02 Task 1; the barrel drops it
// in this plan (Plan 01 Task 2) so intermediate state between waves stays clean.
export * from './public.constants';
export * from './public.interfaces';
export * from './shared-namespace.module';
export * from './namespaced-storage.interface';
export * from './upload-too-large.error';

// Type-only re-export — class itself is internal to this subpath.
export type { NamespacedStorageService } from './namespaced-storage.service';
