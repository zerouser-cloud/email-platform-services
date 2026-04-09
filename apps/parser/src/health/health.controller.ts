import { Controller, Get, Inject } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { HEALTH, DATABASE_HEALTH, STORAGE_HEALTH } from '@email-platform/foundation';
import type { DatabaseHealthIndicator, StorageHealthIndicator } from '@email-platform/foundation';

@Controller(HEALTH.ROUTE)
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    @Inject(DATABASE_HEALTH) private readonly db: DatabaseHealthIndicator,
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
      () => this.db.isHealthy(HEALTH.INDICATOR.POSTGRESQL),
      () => this.storage.isHealthy(HEALTH.INDICATOR.S3),
    ]);
  }
}
