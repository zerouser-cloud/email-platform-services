// Temporary barrel during Plan 01. Deleted in Plan 02.
// Re-exports reports facade so top-level src/index.ts keeps working unchanged.
// Also re-exports the internal primitives so apps still relying on S3CoreModule/BucketStorageModule
// via the public barrel continue to build — this re-export is removed in Plan 02 when the
// top-level barrel flips to `export * from './external';`.
export * from '../internal/storage';
export * from './reports';
