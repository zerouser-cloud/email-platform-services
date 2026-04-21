// packages/config/src/apps/notifier/external-apis.schema.ts
//
// Per-service external-API schema (D-21) — split from the legacy shared
// `packages/config/src/schemas/external-apis.ts`. Only the Telegram fragment
// (used by notifier's Telegram HTTP client) lives here.
//
// W8 completes D-21 fan-out: after this migration all 3 external-API schemas
// (CloudFn/W5, AppStoreSpy/W6, Telegram/W8) are fully split per-service and
// the legacy shared file has no consumers from new apps/ paths. The legacy
// file `./schemas/external-apis.ts` is removed in W9 cleanup; the re-export
// of Telegram from `./schemas/index.ts` root-barrel is pruned in W8 to resolve
// TS2308 ambiguity with the per-app barrel (analogous to W5 CloudFn and W6
// AppStoreSpy handling). Keys MUST match the legacy file verbatim
// (T-999.1.9-19 tampering mitigation).
import { z } from 'zod';

export const TelegramSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_BASE_URL: z.string().url(),
});

export type TelegramConfig = z.infer<typeof TelegramSchema>;
