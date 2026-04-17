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
import { GrpcCaller } from './grpc-caller';

const TOKEN_SUFFIX = {
  CLIENT_GRPC: '_CLIENT_GRPC',
  GRPC_HEALTH: '_GRPC_HEALTH',
} as const;

export interface DefineGrpcClientOpts {
  readonly service: GrpcServiceDeclaration;
  readonly clientToken: symbol;
}

export interface GrpcClientBuildResult {
  readonly imports: Array<Type<unknown> | DynamicModule>;
  readonly providers: Provider[];
  readonly exports: symbol[];
  readonly grpcToken: symbol;
  readonly healthToken: symbol;
}

export function defineGrpcClient<T extends object>(
  opts: DefineGrpcClientOpts,
  build: (grpcClient: ClientGrpc, caller: GrpcCaller) => T,
): GrpcClientBuildResult {
  const upperId = opts.service.id.toUpperCase();
  const grpcToken = Symbol.for(`${upperId}${TOKEN_SUFFIX.CLIENT_GRPC}`);
  const healthToken = Symbol.for(`${upperId}${TOKEN_SUFFIX.GRPC_HEALTH}`);

  const facadeProvider: Provider = {
    provide: opts.clientToken,
    inject: [grpcToken, ClsService, ConfigService],
    useFactory: (grpc: ClientGrpc, cls: ClsService, config: ConfigService) => {
      const caller = new GrpcCaller(
        cls,
        opts.service.grpc.serviceName,
        config.get<number>('GRPC_DEADLINE_MS')!,
        `${upperId}Client`,
      );
      return build(grpc, caller);
    },
  };

  const healthProvider: Provider = {
    provide: healthToken,
    inject: [HealthIndicatorService, grpcToken],
    useFactory: (his: HealthIndicatorService, grpc: ClientGrpc) =>
      new GrpcClientHealthIndicator(his, grpc),
  };

  return {
    imports: [
      TerminusModule,
      ClientsModule.registerAsync([
        {
          name: grpcToken,
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
                interceptors: [createDeadlineInterceptor(config.get<number>('GRPC_DEADLINE_MS')!)],
              },
            },
          }),
        },
      ]),
    ],
    providers: [facadeProvider, healthProvider],
    exports: [opts.clientToken, healthToken],
    grpcToken,
    healthToken,
  };
}
