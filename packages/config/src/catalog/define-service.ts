import { ServiceDeclaration } from './types';

interface DefineServiceInput<Id extends string> {
  id: Id;
  displayName: string;
  port: number;
}

interface DefineGrpcServiceInput<Id extends string> extends DefineServiceInput<Id> {
  grpc: { port: number; serviceName: string };
}

export function defineService<const Id extends string>(
  input: DefineGrpcServiceInput<Id>,
): ServiceDeclaration<Id, true>;

export function defineService<const Id extends string>(
  input: DefineServiceInput<Id>,
): ServiceDeclaration<Id, false>;

export function defineService<const Id extends string>(
  input: DefineServiceInput<Id> & {
    grpc?: { port: number; serviceName: string };
  },
): ServiceDeclaration<Id, boolean> {
  const upperId = input.id.toUpperCase() as Uppercase<Id>;
  return {
    id: input.id,
    displayName: input.displayName,
    port: input.port,
    grpc: input.grpc
      ? {
          port: input.grpc.port,
          package: input.id,
          serviceName: input.grpc.serviceName,
        }
      : undefined,
    envKeys: {
      PORT: `${upperId}_PORT`,
      GRPC_URL: input.grpc ? `${upperId}_GRPC_URL` : undefined,
    },
    diToken: input.grpc ? `${upperId}_GRPC_CLIENT` : `${upperId}_CLIENT`,
  } as ServiceDeclaration<Id, boolean>;
}
