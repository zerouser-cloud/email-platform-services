import { Module, type DynamicModule } from '@nestjs/common';
import { SERVICE } from '@email-platform/config';
import { defineGrpcClient } from '@email-platform/foundation';
import { NotifierClient } from './notifier.client';
import { NOTIFIER_CLIENT_GRPC, NOTIFIER_GRPC_HEALTH } from './notifier-client.constants';

const grpc = defineGrpcClient(
  {
    service: SERVICE.notifier,
    clientToken: SERVICE.notifier.diToken,
    healthToken: NOTIFIER_GRPC_HEALTH,
    grpcToken: NOTIFIER_CLIENT_GRPC,
  },
  (grpcClient, cls, deadlineMs) => new NotifierClient(grpcClient, cls, deadlineMs),
);

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
