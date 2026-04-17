import { Module, type DynamicModule } from '@nestjs/common';
import { SERVICE } from '@email-platform/config';
import { defineGrpcClient } from '@email-platform/foundation';
import { AuthClient } from './auth.client';
import { AUTH_CLIENT_GRPC, AUTH_GRPC_HEALTH } from './auth-client.constants';

const grpc = defineGrpcClient(
  {
    service: SERVICE.auth,
    clientToken: SERVICE.auth.diToken,
    healthToken: AUTH_GRPC_HEALTH,
    grpcToken: AUTH_CLIENT_GRPC,
  },
  (grpcClient, cls, deadlineMs) => new AuthClient(grpcClient, cls, deadlineMs),
);

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
