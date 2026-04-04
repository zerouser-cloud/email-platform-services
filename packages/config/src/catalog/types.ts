export interface GrpcMeta<Id extends string> {
  readonly port: number;
  readonly package: Id;
  readonly serviceName: string;
}

export interface ServiceDeclaration<Id extends string = string, HasGrpc extends boolean = boolean> {
  readonly id: Id;
  readonly displayName: string;
  readonly port: number;
  readonly grpc: HasGrpc extends true ? GrpcMeta<Id> : undefined;
  readonly envKeys: {
    readonly PORT: `${Uppercase<Id>}_PORT`;
    readonly GRPC_URL: HasGrpc extends true ? `${Uppercase<Id>}_GRPC_URL` : undefined;
  };
  readonly diToken: string;
}

export type GrpcServiceDeclaration = ServiceDeclaration<string, true>;
