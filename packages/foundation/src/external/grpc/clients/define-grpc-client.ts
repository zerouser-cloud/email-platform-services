import type { DynamicModule, Provider, Type } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import type { ClientGrpc } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { TerminusModule, HealthIndicatorService } from '@nestjs/terminus';
import { ClsService } from 'nestjs-cls';
import type { GrpcServiceDeclaration } from '@email-platform/config';
import { resolveProtoPath } from '../proto-resolver';
import { createDeadlineInterceptor } from '../../resilience/grpc-deadline.interceptor';
import { GRPC_CLIENT_HEALTH } from './clients.constants';
import { GrpcClientHealthIndicator } from './grpc-client-health.indicator';

export interface DefineGrpcClientOpts {
  readonly service: GrpcServiceDeclaration;
  readonly clientToken: symbol;
  readonly healthToken: symbol;
  readonly grpcToken: symbol;
}

export interface GrpcClientBuildResult {
  readonly imports: Array<Type<unknown> | DynamicModule>;
  readonly providers: Provider[];
  readonly exports: symbol[];
}

export function defineGrpcClient<T extends object>(
  opts: DefineGrpcClientOpts,
  build: (grpc: ClientGrpc, cls: ClsService, deadlineMs: number) => T,
): GrpcClientBuildResult {
  const facadeProvider: Provider = {
    provide: opts.clientToken,
    inject: [opts.grpcToken, ClsService, ConfigService],
    useFactory: (grpc: ClientGrpc, cls: ClsService, config: ConfigService) =>
      build(grpc, cls, config.get<number>('GRPC_DEADLINE_MS')!),
  };

  const healthProvider: Provider = {
    provide: opts.healthToken,
    inject: [HealthIndicatorService, opts.grpcToken],
    useFactory: (his: HealthIndicatorService, grpc: ClientGrpc) =>
      new GrpcClientHealthIndicator(his, grpc),
  };

  return {
    imports: [
      TerminusModule,
      ClientsModule.registerAsync([
        {
          name: opts.grpcToken,
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            transport: Transport.GRPC,
            options: {
              url: config.get<string>(opts.service.envKeys.GRPC_URL!)!,
              package: [opts.service.grpc.package, GRPC_CLIENT_HEALTH.PACKAGE],
              protoPath: [
                resolveProtoPath(opts.service.grpc.package, config.get<string>('PROTO_DIR')!),
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
    exports: [opts.clientToken, opts.healthToken],
  };
}
