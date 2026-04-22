// packages/config/src/apps/sender/external-apis.schema.ts
//
// Per-service external-API schema (D-21) — split from the legacy shared
// `packages/config/src/schemas/external-apis.ts`. Only the CloudFn fragment
// (used by sender's Google Cloud Functions HTTP client) lives here.
//
// Legacy `schemas/external-apis.ts` is NOT removed in W5 — coexistence window
// remains open until W9 cleanup. Keys MUST match the legacy file verbatim
// (T-999.1.9-13 tampering mitigation).
import { z } from 'zod';

export const CloudFnSchema = z.object({
  CLOUDFN_API_KEY: z.string().min(1),
  CLOUDFN_BASE_URL: z.string().url(),
});

export type CloudFnConfig = z.infer<typeof CloudFnSchema>;
