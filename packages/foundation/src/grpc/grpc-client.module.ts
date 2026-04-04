import { Module, DynamicModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import type { GrpcServiceDeclaration } from '@email-platform/config';
import { resolveProtoPath } from './proto-resolver';
import { createDeadlineInterceptor } from '../resilience/grpc-deadline.interceptor';

@Module({})
export class GrpcClientModule {
  static register(service: GrpcServiceDeclaration): DynamicModule {
    return {
      module: GrpcClientModule,
      imports: [
        ClientsModule.registerAsync([
          {
            name: service.diToken,
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
              const grpcUrl = configService.get<string>(service.envKeys.GRPC_URL!);
              const protoDir = configService.get<string>('PROTO_DIR')!;
              const deadlineMs = configService.get<number>('GRPC_DEADLINE_MS')!;
              return {
                transport: Transport.GRPC,
                options: {
                  url: grpcUrl,
                  package: service.grpc.package,
                  protoPath: resolveProtoPath(service.grpc.package, protoDir),
                  channelOptions: {
                    interceptors: [createDeadlineInterceptor(deadlineMs)],
                  },
                },
              };
            },
          },
        ]),
      ],
      exports: [ClientsModule],
    };
  }
}
