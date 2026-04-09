import { Controller, Get, Inject } from '@nestjs/common';
import { HealthCheckService, HealthCheck } from '@nestjs/terminus';
import {
  RabbitMqHealthIndicator,
  HEALTH,
  REPORTS_STORAGE_HEALTH,
  REPORTS_HEALTH_KEY,
} from '@email-platform/foundation';
import type { StorageHealthIndicator } from '@email-platform/foundation';

@Controller(HEALTH.ROUTE)
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly rabbitmq: RabbitMqHealthIndicator,
    @Inject(REPORTS_STORAGE_HEALTH) private readonly reportsStorage: StorageHealthIndicator,
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
      () => this.reportsStorage.isHealthy(REPORTS_HEALTH_KEY),
    ]);
  }
}
