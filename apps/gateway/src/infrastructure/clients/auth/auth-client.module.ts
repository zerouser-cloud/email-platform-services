import { Module, type DynamicModule } from '@nestjs/common';
import { SERVICE } from '@email-platform/config';
import { defineGrpcClient } from '@email-platform/foundation';
import { AuthClient } from './auth.client';

const grpc = defineGrpcClient(
  { service: SERVICE.auth, clientToken: SERVICE.auth.diToken },
  (grpcClient, cls, deadlineMs) => new AuthClient(grpcClient, cls, deadlineMs),
);

// Named re-exports for local consumers (health.controller.ts via barrel — D-10).
// Do NOT export `grpc` directly — that leaks imports/providers/exports and lets consumers bypass forRoot().
export const AUTH_CLIENT_GRPC = grpc.grpcToken;
export const AUTH_GRPC_HEALTH = grpc.healthToken;

@Module({})
export class AuthClientModule {
  static forRoot(): DynamicModule {
    return {
      module: AuthClientModule,
      imports: grpc.imports,
      providers: grpc.providers,
      exports: grpc.exports,
    };
  }
}
