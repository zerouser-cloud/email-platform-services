import { Controller, Get, Inject } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { HEALTH, PERSISTENCE_HEALTH, CACHE_HEALTH } from '@email-platform/foundation';
import type {
  PersistenceHealthIndicator,
  StorageHealthIndicator,
  CacheHealthIndicator,
} from '@email-platform/foundation';
import { PARSER_STORAGE_HEALTH, PARSER_STORAGE_HEALTH_KEY } from '../../../parser.constants';

@Controller(HEALTH.ROUTE)
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    @Inject(PERSISTENCE_HEALTH) private readonly persistence: PersistenceHealthIndicator,
    @Inject(PARSER_STORAGE_HEALTH) private readonly parserStorage: StorageHealthIndicator,
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
      () => this.persistence.isHealthy(HEALTH.INDICATOR.POSTGRESQL),
      () => this.parserStorage.isHealthy(PARSER_STORAGE_HEALTH_KEY),
      () => this.cache.isHealthy(HEALTH.INDICATOR.REDIS),
    ]);
  }
}
