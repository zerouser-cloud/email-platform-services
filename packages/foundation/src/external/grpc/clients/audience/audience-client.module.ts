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
import { AudienceClient } from './audience.client';
import { AUDIENCE_CLIENT_GRPC, AUDIENCE_GRPC_HEALTH } from './audience-client.constants';

const facadeProvider: Provider = {
  provide: SERVICE.audience.diToken,
  inject: [AUDIENCE_CLIENT_GRPC, ClsService, ConfigService],
  useFactory: (
    grpc: ClientGrpc,
    cls: ClsService,
    config: ConfigService,
  ) => new AudienceClient(grpc, cls, config.get<number>('GRPC_DEADLINE_MS')!),
};

const healthProvider: Provider = {
  provide: AUDIENCE_GRPC_HEALTH,
  inject: [HealthIndicatorService, AUDIENCE_CLIENT_GRPC],
  useFactory: (his: HealthIndicatorService, grpc: ClientGrpc) =>
    new GrpcClientHealthIndicator(his, grpc),
};

@Module({})
export class AudienceClientModule {
  static forRoot(): DynamicModule {
    return {
      module: AudienceClientModule,
      imports: [
        TerminusModule,
        ClientsModule.registerAsync([
          {
            name: AUDIENCE_CLIENT_GRPC,
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
              transport: Transport.GRPC,
              options: {
                url: config.get<string>(SERVICE.audience.envKeys.GRPC_URL!)!,
                package: [SERVICE.audience.grpc.package, GRPC_CLIENT_HEALTH.PACKAGE],
                protoPath: [
                  resolveProtoPath(SERVICE.audience.grpc.package, config.get<string>('PROTO_DIR')!),
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
      exports: [SERVICE.audience.diToken, AUDIENCE_GRPC_HEALTH],
    };
  }
}
