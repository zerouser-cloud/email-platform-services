import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HealthCheck, MemoryHealthIndicator } from '@nestjs/terminus';
import { HEALTH } from '@email-platform/foundation';
import { RabbitMQHealthIndicator } from './rabbitmq-health.indicator';

@Controller(HEALTH.ROUTE)
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly rabbitmq: RabbitMQHealthIndicator,
  ) {}

  @Get(HEALTH.LIVE)
  @HealthCheck()
  liveness() {
    return this.health.check([
      () => this.memory.checkHeap(HEALTH.INDICATOR.MEMORY_HEAP, HEALTH.HEAP_LIMIT),
    ]);
  }

  @Get(HEALTH.READY)
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.rabbitmq.isHealthy('rabbitmq'),
    ]);
  }
}
