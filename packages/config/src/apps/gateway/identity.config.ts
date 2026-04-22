// packages/config/src/apps/gateway/identity.config.ts
//
// Pure identity per D-03 / D-17 — no port/displayName/envKeys.
// Gateway is the REST facade and has NO gRPC server, so `defineService` is
// called WITHOUT a `grpc` input. Per the factory overload signature
// (packages/config/src/service.ts), the returned value is a plain
// `ServiceIdentity` (no grpc property) with `diToken = Symbol.for('GATEWAY_CLIENT')`.
//
// Deep-relative import of `defineService` (from '../../service') avoids a collision
// with the legacy `defineService` still re-exported from the root barrel
// (`./catalog/define-service`) during W3-W8 coexistence — identical pattern to
// audience W3 / auth W4 / sender W5 / parser W6.
import { defineService } from '../../service';

export const GATEWAY = defineService({
  id: 'gateway',
  // no grpc — gateway has no gRPC server (HTTP-only REST facade).
});
