import type { DynamicModule, Provider, Type } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import type { ClientGrpc } from '@nestjs/microservices';
import { TerminusModule, HealthIndicatorService } from '@nestjs/terminus';
import type { GrpcServiceIdentity } from '@email-platform/config';
import { resolveProtoPath } from '../proto-resolver';
import { createDeadlineInterceptor } from '../../resilience/grpc-deadline.interceptor';
import { GRPC_CLIENT_CONFIG_PORT, GRPC_CLIENT_HEALTH } from './clients.constants';
import type { GrpcClientConfig } from './grpc-client.interfaces';
import { GrpcClientHealthIndicator } from './grpc-client-health.indicator';
import { promisifyGrpcClient, type Promisified } from './promisify-grpc-client';

const TOKEN_SUFFIX = {
  CLIENT_GRPC: '_CLIENT_GRPC',
  GRPC_HEALTH: '_GRPC_HEALTH',
} as const;

export interface DefineGrpcClientOpts {
  readonly service: GrpcServiceIdentity;
  readonly clientToken: symbol;
}

export interface GrpcClientBuildResult {
  readonly imports: Array<Type<unknown> | DynamicModule>;
  readonly providers: Provider[];
  readonly exports: symbol[];
  readonly grpcToken: symbol;
  readonly healthToken: symbol;
}

// CHANGED (D-09): removed `build` callback parameter; useFactory builds Promisified Proxy directly.
// CHANGED (D-10 — Phase 999.11.1): inject GRPC_CLIENT_CONFIG_PORT (narrow GrpcClientConfig)
// instead of ConfigService — apps own the slice projection from their {Svc}Env.
export function defineGrpcClient<TRaw extends object>(
  opts: DefineGrpcClientOpts,
): GrpcClientBuildResult {
  const upperId = opts.service.id.toUpperCase();
  const grpcToken = Symbol.for(`${upperId}${TOKEN_SUFFIX.CLIENT_GRPC}`);
  const healthToken = Symbol.for(`${upperId}${TOKEN_SUFFIX.GRPC_HEALTH}`);

  const facadeProvider: Provider = {
    provide: opts.clientToken,
    inject: [grpcToken, GRPC_CLIENT_CONFIG_PORT],
    useFactory: (grpc: ClientGrpc, config: GrpcClientConfig): Promisified<TRaw> => {
      const raw = grpc.getService<TRaw>(opts.service.grpc.serviceName);
      return promisifyGrpcClient(raw, {
        defaultDeadlineMs: config.GRPC_DEADLINE_MS,
      });
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
          inject: [GRPC_CLIENT_CONFIG_PORT],
          useFactory: (config: GrpcClientConfig) => ({
            transport: Transport.GRPC,
            options: {
              url: config.grpcUrls[`${opts.service.id.toUpperCase()}_GRPC_URL`],
              package: [opts.service.grpc.package, GRPC_CLIENT_HEALTH.PACKAGE],
              protoPath: [
                resolveProtoPath(opts.service.grpc.package, config.PROTO_DIR),
                require.resolve('grpc-health-check/proto/health/v1/health.proto'),
              ],
              channelOptions: {
                interceptors: [createDeadlineInterceptor(config.GRPC_DEADLINE_MS)],
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
