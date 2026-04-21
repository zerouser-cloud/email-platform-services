// packages/config/src/service.ts
//
// Canonical Identity layer per Three-Layer Rule (infrastructure-client-layering skill).
// Moved from catalog/ per Phase 999.1.9 D-04; simplified per D-17 (no .port/.displayName/.envKeys).
//
// Exposes:
//   - `defineService` factory (overloaded: with grpc → GrpcServiceIdentity, without → ServiceIdentity)
//   - `GrpcServiceIdentity` / `ServiceIdentity` structural contracts
//   - `SERVICE` aggregator composed from the 6 per-app `identity.config.ts` files
//   - `ServiceId` union (`'audience' | 'auth' | ...`)
//
// The `SERVICE` aggregator is the single runtime source of identity metadata for
// consumers (gateway client-modules, service `main.ts` bootstrap, drizzle configs).
// Per-service runtime values (ports, URLs) come from env via each service's
// `{Svc}EnvSchema` — NOT from here.

import { AUDIENCE } from './apps/audience/identity.config';
import { AUTH } from './apps/auth/identity.config';
import { SENDER } from './apps/sender/identity.config';
import { PARSER } from './apps/parser/identity.config';
import { GATEWAY } from './apps/gateway/identity.config';
import { NOTIFIER } from './apps/notifier/identity.config';

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

// SERVICE aggregator — composed from per-app identity.config.ts (D-04 final step).
// Consumers read SERVICE.{svc}.{id,grpc,diToken}; no port/displayName/envKeys per D-17.
export const SERVICE = {
  audience: AUDIENCE,
  auth: AUTH,
  sender: SENDER,
  parser: PARSER,
  gateway: GATEWAY,
  notifier: NOTIFIER,
} as const;

export type ServiceId = keyof typeof SERVICE;
