import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { HEALTH } from '@email-platform/foundation';

@Controller(HEALTH.ROUTE)
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
  ) {}

  @Get(HEALTH.LIVE)
  @HealthCheck()
  liveness() {
    return this.health.check([]);
  }

  @Get(HEALTH.READY)
  @HealthCheck()
  readiness() {
    return this.health.check([]);
  }
}
