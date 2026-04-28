// Per-app config for gateway service — populated in Phase 999.1.9 W7.
// Gateway is the REST facade and HAS NO gRPC server; no external-apis.schema
// file is needed (gateway does not itself call any 3rd-party API — it only
// routes HTTP traffic to the 5 upstream gRPC services).
export * from './identity.config';
export * from './topology.schema';
export * from './env.schema';
