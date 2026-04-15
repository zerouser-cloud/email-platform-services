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
import { ParserClient } from './parser.client';
import { PARSER_CLIENT_GRPC, PARSER_GRPC_HEALTH } from './parser-client.constants';

const facadeProvider: Provider = {
  provide: SERVICE.parser.diToken,
  inject: [PARSER_CLIENT_GRPC, ClsService, ConfigService],
  useFactory: (grpc: ClientGrpc, cls: ClsService, config: ConfigService) =>
    new ParserClient(grpc, cls, config.get<number>('GRPC_DEADLINE_MS')!),
};

const healthProvider: Provider = {
  provide: PARSER_GRPC_HEALTH,
  inject: [HealthIndicatorService, PARSER_CLIENT_GRPC],
  useFactory: (his: HealthIndicatorService, grpc: ClientGrpc) =>
    new GrpcClientHealthIndicator(his, grpc),
};

@Module({})
export class ParserClientModule {
  static forRoot(): DynamicModule {
    return {
      module: ParserClientModule,
      imports: [
        TerminusModule,
        ClientsModule.registerAsync([
          {
            name: PARSER_CLIENT_GRPC,
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
              transport: Transport.GRPC,
              options: {
                url: config.get<string>(SERVICE.parser.envKeys.GRPC_URL!)!,
                package: [SERVICE.parser.grpc.package, GRPC_CLIENT_HEALTH.PACKAGE],
                protoPath: [
                  resolveProtoPath(SERVICE.parser.grpc.package, config.get<string>('PROTO_DIR')!),
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
      exports: [SERVICE.parser.diToken, PARSER_GRPC_HEALTH],
    };
  }
}
