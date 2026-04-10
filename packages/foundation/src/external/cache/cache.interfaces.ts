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
