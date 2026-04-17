import { Module, type DynamicModule } from '@nestjs/common';
import { SERVICE } from '@email-platform/config';
import { defineGrpcClient } from '@email-platform/foundation';
import { AudienceClient } from './audience.client';
import { AUDIENCE_CLIENT_GRPC, AUDIENCE_GRPC_HEALTH } from './audience-client.constants';

const grpc = defineGrpcClient(
  {
    service: SERVICE.audience,
    clientToken: SERVICE.audience.diToken,
    healthToken: AUDIENCE_GRPC_HEALTH,
    grpcToken: AUDIENCE_CLIENT_GRPC,
  },
  (grpcClient, cls, deadlineMs) => new AudienceClient(grpcClient, cls, deadlineMs),
);

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
