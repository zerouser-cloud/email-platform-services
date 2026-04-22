import { Module, type DynamicModule } from '@nestjs/common';
import { SERVICE } from '@email-platform/config';
import { defineGrpcClient } from '@email-platform/foundation';
import { AudienceProto } from '@email-platform/contracts';

const grpc = defineGrpcClient<AudienceProto.AudienceServiceClient>({
  service: SERVICE.audience,
  clientToken: SERVICE.audience.diToken,
});

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
