// packages/config/src/service.ts
//
// Canonical Identity layer per Three-Layer Rule (infrastructure-client-layering skill).
// Moved from catalog/ per Phase 999.1.9 D-04; simplified per D-17 (no .port/.displayName/.envKeys).
//
// W3 coexistence note:
// - This file exports the NEW `defineService` factory + identity types.
// - The legacy `SERVICE` aggregator remains in `./catalog/services.ts` until W9 cleanup
//   (it still carries .port/.displayName/.envKeys consumed by legacy topology.ts +
//   4 legacy main.ts call-sites for `SERVICE.{svc}.grpc.port`).
// - A new `SERVICE` aggregator composed from per-app identity.config.ts files is
//   introduced in W9; in W3-W8 only per-app identities are individually consumable
//   (e.g., `import { AUDIENCE } from '@email-platform/config/apps/audience'`).

export interface GrpcServiceIdentity {
  readonly id: string;
  readonly grpc: { readonly package: string; readonly serviceName: string };
  readonly diToken: symbol;
}

export interface ServiceIdentity {
  readonly id: string;
  readonly grpc?: { readonly package: string; readonly serviceName: string };
  readonly diToken: symbol;
}

interface DefineServiceInput<Id extends string> {
  readonly id: Id;
}

interface DefineGrpcServiceInput<Id extends string> extends DefineServiceInput<Id> {
  readonly grpc: { readonly serviceName: string };
}

// Overloads — type-safe: grpc input → GrpcServiceIdentity return, no grpc → ServiceIdentity.
export function defineService<const Id extends string>(
  input: DefineGrpcServiceInput<Id>,
): GrpcServiceIdentity;
export function defineService<const Id extends string>(
  input: DefineServiceInput<Id>,
): ServiceIdentity;
export function defineService<const Id extends string>(
  input: DefineServiceInput<Id> & { grpc?: { serviceName: string } },
): ServiceIdentity {
  const upperId = input.id.toUpperCase() as Uppercase<Id>;
  return {
    id: input.id,
    grpc: input.grpc
      ? { package: input.id, serviceName: input.grpc.serviceName }
      : undefined,
    diToken: input.grpc
      ? Symbol.for(`${upperId}_GRPC_CLIENT`)
      : Symbol.for(`${upperId}_CLIENT`),
  };
}
