// Canonical Config Access Contract (Phase 999.11.1 D-10) — narrow config re-export.
// Re-exported from @email-platform/config to keep a single source of truth.
// The LoggingConfig type carries branded LogLevel + LogFormat enum members natively —
// consumers of LOGGING_CONFIG_PORT never need `as LogLevel` / `as LogFormat` casts.
// The app-owned useFactory binds {SVC}_CONFIG → LoggingConfig shape for LOGGING_CONFIG_PORT.
export type { LoggingConfig } from '@email-platform/config';
