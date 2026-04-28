import { Controller, Get, Inject } from '@nestjs/common';
import { HealthCheckService, HealthCheck } from '@nestjs/terminus';
import {
  HEALTH,
  MESSAGING_HEALTH,
  PUBLIC_STORAGE_HEALTH,
  PUBLIC_HEALTH_KEY,
  CACHE_HEALTH,
} from '@email-platform/foundation';
import type {
  StorageHealthIndicator,
  CacheHealthIndicator,
  MessagingHealthIndicator,
} from '@email-platform/foundation';

@Controller(HEALTH.ROUTE)
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    @Inject(MESSAGING_HEALTH) private readonly messaging: MessagingHealthIndicator,
    @Inject(PUBLIC_STORAGE_HEALTH) private readonly publicStorage: StorageHealthIndicator,
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
      () => this.messaging.isHealthy(HEALTH.INDICATOR.RABBITMQ),
      () => this.publicStorage.isHealthy(PUBLIC_HEALTH_KEY),
      () => this.cache.isHealthy(HEALTH.INDICATOR.REDIS),
    ]);
  }
}
