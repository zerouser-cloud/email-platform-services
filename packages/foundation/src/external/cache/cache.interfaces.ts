import type { HealthIndicatorResult } from '@nestjs/terminus';
import type { ZodType } from 'zod';

/**
 * Tier 1 result type for `CachePort.get<T>` — discriminated union over
 * fetch outcome. Three branches: `absent` (key not in Redis), `corrupt`
 * (key present but JSON.parse failed or schema validation failed), and
 * `value` (key present with successfully decoded payload).
 *
 * Shape locked verbatim per D-07 in 999.19.2-CONTEXT.md — do NOT refactor
 * or extract sub-types. Discriminator literals (`'absent' | 'corrupt' | 'value'`,
 * `'json-parse' | 'schema-mismatch'`) are deliberate type literals; see
 * `no-magic-values` skill exception for type literals.
 *
 * Caller dispatch on `status` follows `branching-patterns` skill — guard
 * clauses or Record dispatch only, no switch/case (D-08 in 999.19.2-CONTEXT.md).
 */
export type CacheGetResult<T> =
  | { readonly status: 'absent' }
  | { readonly status: 'corrupt'; readonly reason: 'json-parse' | 'schema-mismatch' }
  | { readonly status: 'value'; readonly value: T };

export interface CachePort {
  get<T>(key: string, schema?: ZodType<T>): Promise<CacheGetResult<T>>;
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
