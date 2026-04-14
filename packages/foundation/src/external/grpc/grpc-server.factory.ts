import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import type { Server } from '@grpc/grpc-js';
import type { GrpcServiceDeclaration } from '@email-platform/config';
import { HealthImplementation } from 'grpc-health-check';
import { resolveProtoPath } from './proto-resolver';
import { HEALTH } from '../health/health-constants';
import { SERVER } from '../constants';

export function createGrpcServerOptions(
  service: GrpcServiceDeclaration,
  protoDir: string,
): MicroserviceOptions {
  const healthImpl = new HealthImplementation({
    [HEALTH.GRPC_SERVICE_OVERALL]: HEALTH.GRPC_STATUS_SERVING,
  });

  return {
    transport: Transport.GRPC,
    options: {
      package: service.grpc.package,
      protoPath: resolveProtoPath(service.grpc.package, protoDir),
      url: `${SERVER.DEFAULT_HOST}:${service.grpc.port}`,
      onLoadPackageDefinition: (_pkg: unknown, server: Server) => {
        healthImpl.addToServer(server);
      },
    },
  };
}
