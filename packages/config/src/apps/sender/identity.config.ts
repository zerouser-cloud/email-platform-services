// packages/config/src/apps/sender/identity.config.ts
//
// Pure identity per D-03 / D-17 — no port/displayName/envKeys.
// Deep-relative import of `defineService` (from '../../service') avoids a collision
// with the legacy `defineService` still re-exported from root barrel
// (`./catalog/define-service`) during W3-W8 coexistence.
import { defineService } from '../../service';

export const SENDER = defineService({
  id: 'sender',
  grpc: { serviceName: 'SenderService' },
});
