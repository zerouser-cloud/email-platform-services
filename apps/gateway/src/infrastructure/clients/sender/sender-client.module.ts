import { Module, type DynamicModule } from '@nestjs/common';
import { SERVICE } from '@email-platform/config';
import { defineGrpcClient } from '@email-platform/foundation';
import { SenderClient } from './sender.client';
import { SENDER_CLIENT_GRPC, SENDER_GRPC_HEALTH } from './sender-client.constants';

const grpc = defineGrpcClient(
  {
    service: SERVICE.sender,
    clientToken: SERVICE.sender.diToken,
    healthToken: SENDER_GRPC_HEALTH,
    grpcToken: SENDER_CLIENT_GRPC,
  },
  (grpcClient, cls, deadlineMs) => new SenderClient(grpcClient, cls, deadlineMs),
);

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
