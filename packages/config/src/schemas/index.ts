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
// root-barrel ambiguity with `./apps/sender` (TS2308). The underlying legacy
// file `./external-apis.ts` is kept intact during coexistence — consumers of
// Telegram/AppStoreSpy still use this barrel (migrated in W6/W8).
// Full legacy file removed in W9 cleanup.
export {
  TelegramSchema,
  type TelegramConfig,
  AppStoreSpySchema,
  type AppStoreSpyConfig,
} from './external-apis';
