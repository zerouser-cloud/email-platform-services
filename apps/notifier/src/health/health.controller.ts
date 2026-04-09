import { Controller, Get, Inject } from '@nestjs/common';
import { HealthCheckService, HealthCheck } from '@nestjs/terminus';
import { RabbitMqHealthIndicator, HEALTH, STORAGE_HEALTH } from '@email-platform/foundation';
import type { StorageHealthIndicator } from '@email-platform/foundation';

@Controller(HEALTH.ROUTE)
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly rabbitmq: RabbitMqHealthIndicator,
    @Inject(STORAGE_HEALTH) private readonly storage: StorageHealthIndicator,
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
      () => this.storage.isHealthy(HEALTH.INDICATOR.S3),
    ]);
  }
}
