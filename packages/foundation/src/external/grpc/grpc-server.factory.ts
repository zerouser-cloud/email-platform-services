import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import type { Server } from '@grpc/grpc-js';
import type { GrpcServiceIdentity } from '@email-platform/config';
import { HealthImplementation } from 'grpc-health-check';
import { resolveProtoPath } from './proto-resolver';
import { HEALTH } from '../health/health-constants';
import { SERVER } from '../constants';

/**
 * Assemble gRPC microservice options from a service identity + env-driven port.
 *
 * Phase 999.1.9 D-16: `grpcPort` is an explicit parameter (read from the
 * service's `{SVC}_GRPC_PORT` env via its `{Svc}Env` type) rather than being
 * pulled from catalog metadata (the legacy `grpc.port` field on the service
 * declaration — removed per D-17). This keeps HTTP↔gRPC server ports
 * symmetric: both come from env.
 *
 * Phase 999.1.9 W9: `GrpcServiceIdentity` is the canonical shape from
 * `@email-platform/config` — 3 fields (`id`, `grpc`, `diToken`). Legacy
 * `ServiceDeclaration` (with `port`/`displayName`/`envKeys`) was deleted in
 * this wave; runtime still reads only `id` + `grpc.package`.
 */
export function createGrpcServerOptions(
  service: GrpcServiceIdentity,
  grpcPort: number,
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
      url: `${SERVER.DEFAULT_HOST}:${grpcPort}`,
      onLoadPackageDefinition: (_pkg: unknown, server: Server) => {
        healthImpl.addToServer(server);
      },
    },
  };
}
