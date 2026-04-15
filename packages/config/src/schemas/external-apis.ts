import { z } from 'zod';

// Phase 24 D-19: per-service adapters consume these.
// No defaults, no optionals, no z.coerce.boolean — every value required from env.

export const TelegramSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_BASE_URL: z.string().url(),
});
export type TelegramConfig = z.infer<typeof TelegramSchema>;

export const AppStoreSpySchema = z.object({
  APPSTORESPY_API_KEY: z.string().min(1),
  APPSTORESPY_BASE_URL: z.string().url(),
});
export type AppStoreSpyConfig = z.infer<typeof AppStoreSpySchema>;

export const CloudFnSchema = z.object({
  CLOUDFN_API_KEY: z.string().min(1),
  CLOUDFN_BASE_URL: z.string().url(),
});
export type CloudFnConfig = z.infer<typeof CloudFnSchema>;
