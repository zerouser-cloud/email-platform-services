// Outbound gRPC clients barrel — aggregates the composer + 5 per-upstream sub-modules.
// `export *` from each sub-module transitively re-exports that upstream's 2 named tokens
// (AUTH_CLIENT_GRPC / AUTH_GRPC_HEALTH pattern — per Phase 999.7.3 naming) alongside its
// *ClientModule class.
//
// Consumer surface (verified):
//   - HealthController consumes 5 *_GRPC_HEALTH tokens via this barrel (Pitfall 9 consolidation)
//   - Root GatewayModule consumes GrpcClientsModule composer via this barrel
export * from './grpc-clients.module';
export * from './auth';
export * from './sender';
export * from './parser';
export * from './audience';
export * from './notifier';
