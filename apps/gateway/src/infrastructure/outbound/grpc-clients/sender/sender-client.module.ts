import { Module, type DynamicModule } from '@nestjs/common';
import { SERVICE } from '@email-platform/config';
import { defineGrpcClient } from '@email-platform/foundation';
import { SenderProto } from '@email-platform/contracts';

const grpc = defineGrpcClient<SenderProto.SenderServiceClient>({
  service: SERVICE.sender,
  clientToken: SERVICE.sender.diToken,
});

// Named re-exports for local consumers (health.controller.ts via barrel — D-10).
// Do NOT export `grpc` directly — that leaks imports/providers/exports and lets consumers bypass forRoot().
export const SENDER_CLIENT_GRPC = grpc.grpcToken;
export const SENDER_GRPC_HEALTH = grpc.healthToken;

@Module({})
export class SenderClientModule {
  static forRoot(): DynamicModule {
    return {
      module: SenderClientModule,
      imports: grpc.imports,
      providers: grpc.providers,
      exports: grpc.exports,
    };
  }
}
