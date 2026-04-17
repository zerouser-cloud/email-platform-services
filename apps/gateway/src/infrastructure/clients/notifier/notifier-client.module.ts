import { Module, type DynamicModule } from '@nestjs/common';
import { SERVICE } from '@email-platform/config';
import { defineGrpcClient } from '@email-platform/foundation';
import { NotifierClient } from './notifier.client';

const grpc = defineGrpcClient(
  { service: SERVICE.notifier, clientToken: SERVICE.notifier.diToken },
  (grpcClient, caller) => new NotifierClient(grpcClient, caller),
);

// Named re-exports for local consumers (health.controller.ts via barrel — D-10).
// Do NOT export `grpc` directly — that leaks imports/providers/exports and lets consumers bypass forRoot().
export const NOTIFIER_CLIENT_GRPC = grpc.grpcToken;
export const NOTIFIER_GRPC_HEALTH = grpc.healthToken;

@Module({})
export class NotifierClientModule {
  static forRoot(): DynamicModule {
    return {
      module: NotifierClientModule,
      imports: grpc.imports,
      providers: grpc.providers,
      exports: grpc.exports,
    };
  }
}
