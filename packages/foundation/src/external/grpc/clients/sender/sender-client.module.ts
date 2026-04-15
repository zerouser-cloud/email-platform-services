import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { ClientsModule, Transport, ClientGrpc } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { TerminusModule, HealthIndicatorService } from '@nestjs/terminus';
import { ClsService } from 'nestjs-cls';
import { SERVICE } from '@email-platform/config';
import { resolveProtoPath } from '../../proto-resolver';
import { createDeadlineInterceptor } from '../../../resilience/grpc-deadline.interceptor';
import { GRPC_CLIENT_HEALTH } from '../clients.constants';
import { GrpcClientHealthIndicator } from '../grpc-client-health.indicator';
import { SenderClient } from './sender.client';
import { SENDER_CLIENT_GRPC, SENDER_GRPC_HEALTH } from './sender-client.constants';

const facadeProvider: Provider = {
  provide: SERVICE.sender.diToken,
  inject: [SENDER_CLIENT_GRPC, ClsService, ConfigService],
  useFactory: (grpc: ClientGrpc, cls: ClsService, config: ConfigService) =>
    new SenderClient(grpc, cls, config.get<number>('GRPC_DEADLINE_MS')!),
};

const healthProvider: Provider = {
  provide: SENDER_GRPC_HEALTH,
  inject: [HealthIndicatorService, SENDER_CLIENT_GRPC],
  useFactory: (his: HealthIndicatorService, grpc: ClientGrpc) =>
    new GrpcClientHealthIndicator(his, grpc),
};

@Module({})
export class SenderClientModule {
  static forRoot(): DynamicModule {
    return {
      module: SenderClientModule,
      imports: [
        TerminusModule,
        ClientsModule.registerAsync([
          {
            name: SENDER_CLIENT_GRPC,
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
              transport: Transport.GRPC,
              options: {
                url: config.get<string>(SERVICE.sender.envKeys.GRPC_URL!)!,
                package: [SERVICE.sender.grpc.package, GRPC_CLIENT_HEALTH.PACKAGE],
                protoPath: [
                  resolveProtoPath(SERVICE.sender.grpc.package, config.get<string>('PROTO_DIR')!),
                  require.resolve('grpc-health-check/proto/health/v1/health.proto'),
                ],
                channelOptions: {
                  interceptors: [
                    createDeadlineInterceptor(config.get<number>('GRPC_DEADLINE_MS')!),
                  ],
                },
              },
            }),
          },
        ]),
      ],
      providers: [facadeProvider, healthProvider],
      exports: [SERVICE.sender.diToken, SENDER_GRPC_HEALTH],
    };
  }
}
