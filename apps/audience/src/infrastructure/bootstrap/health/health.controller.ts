import { Controller, Get, Inject } from '@nestjs/common';
import { HealthCheck, HealthCheckService, type HealthCheckResult } from '@nestjs/terminus';
import { HEALTH, PERSISTENCE_HEALTH, CACHE_HEALTH } from '@email-platform/foundation';
import type { PersistenceHealthIndicator, CacheHealthIndicator } from '@email-platform/foundation';

@Controller(HEALTH.ROUTE)
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    @Inject(PERSISTENCE_HEALTH) private readonly persistence: PersistenceHealthIndicator,
    @Inject(CACHE_HEALTH) private readonly cache: CacheHealthIndicator,
  ) {}

  @Get(HEALTH.LIVE)
  @HealthCheck()
  liveness() {
    return this.health.check([]);
  }

  @Get(HEALTH.READY)
  @HealthCheck()
  readiness(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.persistence.isHealthy(HEALTH.INDICATOR.PERSISTENCE),
      () => this.cache.isHealthy(HEALTH.INDICATOR.CACHE),
    ]);
  }
}
