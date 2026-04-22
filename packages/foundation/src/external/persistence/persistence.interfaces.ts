import type { HealthIndicatorResult } from '@nestjs/terminus';

export interface DatabaseHealthIndicator {
  isHealthy(key: string): Promise<HealthIndicatorResult>;
}

// Canonical Config Access Contract (Phase 999.11.1 D-10) — narrow config re-export.
// Re-exported from @email-platform/config to keep a single source of truth.
// The app-owned useFactory binds {SVC}_CONFIG → PersistenceConfig shape for PERSISTENCE_CONFIG_PORT.
export type { DatabaseConfig as PersistenceConfig } from '@email-platform/config';
