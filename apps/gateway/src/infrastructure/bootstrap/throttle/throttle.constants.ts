// Extracted from throttle.module.ts per Phase 999.11.2 OQ-4 — aesthetic consistency with
// per-module HTTP constants pattern (cloudfn-client.constants.ts, telegram-client.constants.ts
// in sender/notifier services). Name-only discriminators for @nestjs/throttler tiered config.
export const THROTTLE_TIER = {
  BURST: 'burst',
  SUSTAINED: 'sustained',
} as const;
