import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HealthCheck } from '@nestjs/terminus';
import { RabbitMqHealthIndicator, HEALTH } from '@email-platform/foundation';

@Controller(HEALTH.ROUTE)
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly rabbitmq: RabbitMqHealthIndicator,
  ) {}

  @Get(HEALTH.LIVE)
  @HealthCheck()
  liveness() {
    return this.health.check([]);
  }

  @Get(HEALTH.READY)
  @HealthCheck()
  readiness() {
    return this.health.check([() => this.rabbitmq.isHealthy(HEALTH.INDICATOR.RABBITMQ)]);
  }
}
