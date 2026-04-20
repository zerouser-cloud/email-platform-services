/**
 * Notifier Canonical Config Access Contract (Phase 999.11.1 D-08).
 *
 * Phase 999.11.2 D-10: relocated from root `apps/notifier/src/notifier.constants.ts`
 * into `bootstrap/config/` alongside the env schema, provider, and @Global() module
 * per one-file-per-export convention (established by Plan 01). Domain port Symbols
 * (HANDLE_EVENT_PORT, NOTIFICATION_SENDER_PORT) remain at the root (D-11b).
 */
export const NOTIFIER_CONFIG = Symbol('NOTIFIER_CONFIG');
