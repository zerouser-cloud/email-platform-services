// packages/config/src/index.ts — target state after Phase 999.1.9 W9 cleanup.
//
// Layout:
//   - `./service`        — SERVICE aggregator, defineService, identity types
//   - `./env-constants`  — LOG_LEVEL / LOG_FORMAT const maps
//   - `./infra`          — shared infrastructure schemas (Database, Redis, Rabbit, Storage,
//                          Logging, Grpc, Cors, RateLimit) — used by per-app env.schemas +
//                          4 drizzle.config.ts (DatabaseSchema)
//   - `./apps/<svc>`     — per-service identity, topology, env, external-apis schemas
//
// Legacy layout (topology.ts / env-schema.ts / compose.ts / catalog/ / schemas/)
// was deleted in W9; all consumers migrated to per-app barrels in W3-W8.

export * from './service';
export * from './env-constants';
export * from './infra';
export * from './apps/audience';
export * from './apps/auth';
export * from './apps/sender';
export * from './apps/parser';
export * from './apps/gateway';
export * from './apps/notifier';
