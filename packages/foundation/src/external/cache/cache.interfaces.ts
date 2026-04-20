import type { HealthIndicatorResult } from '@nestjs/terminus';

export interface CachePort {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlMs: number): Promise<void>;
  del(key: string): Promise<void>;
}

export interface CacheHealthIndicator {
  isHealthy(key: string): Promise<HealthIndicatorResult>;
}

export interface CacheModuleOptions {
  namespace: string;
}

// Canonical Config Access Contract (Phase 999.11.1 D-10) — narrow config re-export.
// Re-exported from @email-platform/config to keep a single source of truth.
// The app-owned useFactory binds {SVC}_CONFIG → CacheConfig shape for CACHE_CONFIG_PORT.
export type { RedisConfig as CacheConfig } from '@email-platform/config';
