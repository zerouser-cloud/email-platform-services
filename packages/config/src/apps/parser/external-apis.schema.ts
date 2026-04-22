// packages/config/src/apps/parser/external-apis.schema.ts
//
// Per-service external-API schema (D-21) — split from the legacy shared
// `packages/config/src/schemas/external-apis.ts`. Only the AppStoreSpy fragment
// (used by parser's AppStoreSpy HTTP client) lives here.
//
// Legacy `schemas/external-apis.ts` is NOT removed in W6 — coexistence window
// remains open until W9 cleanup. The re-export of AppStoreSpy from the
// `./schemas/index.ts` root-barrel is pruned in W6 to resolve TS2308 ambiguity
// with the per-app barrel (analogous to W5 CloudFn handling). Keys MUST match
// the legacy file verbatim (T-999.1.9-15 tampering mitigation).
import { z } from 'zod';

export const AppStoreSpySchema = z.object({
  APPSTORESPY_API_KEY: z.string().min(1),
  APPSTORESPY_BASE_URL: z.string().url(),
});

export type AppStoreSpyConfig = z.infer<typeof AppStoreSpySchema>;
