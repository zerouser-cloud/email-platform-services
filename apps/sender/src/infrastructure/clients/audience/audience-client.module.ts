import { Module, type DynamicModule } from '@nestjs/common';
import { SERVICE } from '@email-platform/config';
import { defineGrpcClient } from '@email-platform/foundation';
import { AudienceClient } from './audience.client';

const grpc = defineGrpcClient(
  { service: SERVICE.audience, clientToken: SERVICE.audience.diToken },
  (grpcClient, cls, deadlineMs) => new AudienceClient(grpcClient, cls, deadlineMs),
);

// Named re-exports for local consumers (health.controller.ts via barrel — D-10).
// Do NOT export `grpc` directly — that leaks imports/providers/exports and lets consumers bypass forRoot().
export const AUDIENCE_CLIENT_GRPC = grpc.grpcToken;
export const AUDIENCE_GRPC_HEALTH = grpc.healthToken;

@Module({})
export class AudienceClientModule {
  static forRoot(): DynamicModule {
    return {
      module: AudienceClientModule,
      imports: grpc.imports,
      providers: grpc.providers,
      exports: grpc.exports,
    };
  }
}
