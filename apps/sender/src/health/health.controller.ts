import { Controller, Get, Inject } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { RedisHealthIndicator, HEALTH, DATABASE_HEALTH } from '@email-platform/foundation';
import type { DatabaseHealthIndicator } from '@email-platform/foundation';

@Controller(HEALTH.ROUTE)
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    @Inject(DATABASE_HEALTH) private readonly db: DatabaseHealthIndicator,
    private readonly redis: RedisHealthIndicator,
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
      () => this.db.isHealthy(HEALTH.INDICATOR.POSTGRESQL),
      () => this.redis.isHealthy(HEALTH.INDICATOR.REDIS),
    ]);
  }
}
