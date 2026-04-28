import { Controller, Get, Inject } from '@nestjs/common';
import { HealthCheckService, HealthCheck } from '@nestjs/terminus';
import {
  RabbitMqHealthIndicator,
  HEALTH,
  PUBLIC_BUCKET_HEALTH,
  PUBLIC_HEALTH_KEY,
  CACHE_HEALTH,
} from '@email-platform/foundation';
import type { StorageHealthIndicator, CacheHealthIndicator } from '@email-platform/foundation';

@Controller(HEALTH.ROUTE)
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    // class-based DI preserved per Phase 999.12 RESEARCH §S-5 (pre-existing
    // asymmetry; promotion to Symbol-based DI deferred to a future phase).
    private readonly rabbitmq: RabbitMqHealthIndicator,
    @Inject(PUBLIC_BUCKET_HEALTH) private readonly publicBucket: StorageHealthIndicator,
    @Inject(CACHE_HEALTH) private readonly cache: CacheHealthIndicator,
  ) {}

  @Get(HEALTH.LIVE)
  @HealthCheck()
  liveness() {
    return this.health.check([]);
  }

  @Get(HEALTH.READY)
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.rabbitmq.isHealthy(HEALTH.INDICATOR.RABBITMQ),
      () => this.publicBucket.isHealthy(PUBLIC_HEALTH_KEY),
      () => this.cache.isHealthy(HEALTH.INDICATOR.REDIS),
    ]);
  }
}
