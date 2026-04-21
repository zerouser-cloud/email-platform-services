export { DatabaseSchema, type DatabaseConfig } from './database';
export { RedisSchema, type RedisConfig } from './redis';
export { RabbitSchema, type RabbitConfig } from './rabbitmq';
export { StorageSchema, type StorageConfig } from './storage';
export { LoggingSchema, type LoggingConfig } from './logging';
export { GrpcSchema, type GrpcConfig } from './grpc';
export { CorsSchema, type CorsConfig } from './cors';
export { RateLimitSchema, type RateLimitConfig } from './rate-limit';
// Phase 999.1.9 W5 (D-21): `CloudFnSchema` / `CloudFnConfig` are now canonically
// exported from `packages/config/src/apps/sender/external-apis.schema.ts`
// (per-service split). They are intentionally NOT re-exported here to avoid
// root-barrel ambiguity with `./apps/sender` (TS2308).
// Phase 999.1.9 W6 (D-21): `AppStoreSpySchema` / `AppStoreSpyConfig` likewise
// relocated to `packages/config/src/apps/parser/external-apis.schema.ts` and
// pruned from this barrel for the same reason.
// Phase 999.1.9 W8 (D-21): `TelegramSchema` / `TelegramConfig` likewise
// relocated to `packages/config/src/apps/notifier/external-apis.schema.ts`.
// D-21 fan-out COMPLETE — all 3 external-API schemas now split per-service.
// The underlying legacy file `./external-apis.ts` now has NO re-exports from
// this root barrel; full legacy file removed in W9 cleanup.
