// Domain-agnostic gRPC client primitives.
// Per-service typed facades live in apps/{service}/src/infrastructure/clients/.

export { GrpcClientHealthIndicator } from './grpc-client-health.indicator';
export { defineGrpcClient } from './define-grpc-client';
export type { DefineGrpcClientOpts, GrpcClientBuildResult } from './define-grpc-client';

// Shared types for consumer typing of deadline opts and log fields:
export type { CallOpts, GrpcClientLogFields } from './grpc-client-logging.types';
