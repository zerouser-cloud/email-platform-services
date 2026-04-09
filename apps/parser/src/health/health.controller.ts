import { Controller, Get, Inject } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import {
  HEALTH,
  DATABASE_HEALTH,
  REPORTS_STORAGE_HEALTH,
  REPORTS_HEALTH_KEY,
} from '@email-platform/foundation';
import type { DatabaseHealthIndicator, StorageHealthIndicator } from '@email-platform/foundation';
import { PARSER_STORAGE_HEALTH, PARSER_STORAGE_HEALTH_KEY } from '../parser.constants';

@Controller(HEALTH.ROUTE)
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    @Inject(DATABASE_HEALTH) private readonly db: DatabaseHealthIndicator,
    @Inject(PARSER_STORAGE_HEALTH) private readonly parserStorage: StorageHealthIndicator,
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
      () => this.db.isHealthy(HEALTH.INDICATOR.POSTGRESQL),
      () => this.parserStorage.isHealthy(PARSER_STORAGE_HEALTH_KEY),
      () => this.reportsStorage.isHealthy(REPORTS_HEALTH_KEY),
    ]);
  }
}
