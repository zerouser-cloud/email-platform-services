import { Controller, Get, Inject } from '@nestjs/common';
import { HealthCheckService, HealthCheck } from '@nestjs/terminus';
import {
  RabbitMqHealthIndicator,
  HEALTH,
  PUBLIC_STORAGE_HEALTH,
  PUBLIC_HEALTH_KEY,
} from '@email-platform/foundation';
import type { StorageHealthIndicator } from '@email-platform/foundation';

@Controller(HEALTH.ROUTE)
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly rabbitmq: RabbitMqHealthIndicator,
    @Inject(PUBLIC_STORAGE_HEALTH) private readonly publicStorage: StorageHealthIndicator,
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
      () => this.publicStorage.isHealthy(PUBLIC_HEALTH_KEY),
    ]);
  }
}
