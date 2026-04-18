// Domain-agnostic gRPC client primitives.
// Per-service typed facades live in apps/{service}/src/infrastructure/clients/.

export { GrpcClientHealthIndicator } from './grpc-client-health.indicator';
export { defineGrpcClient } from './define-grpc-client';
export type { DefineGrpcClientOpts, GrpcClientBuildResult } from './define-grpc-client';
export { promisifyGrpcClient } from './promisify-grpc-client';
export type { Promisified, PromisifyOpts } from './promisify-grpc-client';

// Shared types — CallOpts still used per-call; GrpcClientLogFields kept for future
// observability phase (D-10 — leaning keep, Claude's Discretion).
export type { CallOpts, GrpcClientLogFields } from './grpc-client-logging.types';
