import { Controller, Get, Inject } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthCheckService, HealthCheck, type HealthIndicatorResult } from '@nestjs/terminus';
import { HEALTH, getBuildInfo, GrpcClientHealthIndicator } from '@email-platform/foundation';
import { AUTH_GRPC_HEALTH } from '../../clients/auth';
import { SENDER_GRPC_HEALTH } from '../../clients/sender';
import { PARSER_GRPC_HEALTH } from '../../clients/parser';
import { AUDIENCE_GRPC_HEALTH } from '../../clients/audience';
import { NOTIFIER_GRPC_HEALTH } from '../../clients/notifier';
import { SERVICE } from '@email-platform/config';

@SkipThrottle()
@Controller(HEALTH.ROUTE)
export class HealthController {
  private readonly upstreams: ReadonlyArray<{ key: string; indicator: GrpcClientHealthIndicator }>;

  constructor(
    private readonly health: HealthCheckService,
    @Inject(AUTH_GRPC_HEALTH) authHealth: GrpcClientHealthIndicator,
    @Inject(SENDER_GRPC_HEALTH) senderHealth: GrpcClientHealthIndicator,
    @Inject(PARSER_GRPC_HEALTH) parserHealth: GrpcClientHealthIndicator,
    @Inject(AUDIENCE_GRPC_HEALTH) audienceHealth: GrpcClientHealthIndicator,
    @Inject(NOTIFIER_GRPC_HEALTH) notifierHealth: GrpcClientHealthIndicator,
  ) {
    this.upstreams = [
      { key: SERVICE.auth.id, indicator: authHealth },
      { key: SERVICE.sender.id, indicator: senderHealth },
      { key: SERVICE.parser.id, indicator: parserHealth },
      { key: SERVICE.audience.id, indicator: audienceHealth },
      { key: SERVICE.notifier.id, indicator: notifierHealth },
    ];
  }

  @Get(HEALTH.LIVE)
  @HealthCheck()
  liveness() {
    return this.health.check([]).then((result) => ({ ...result, build: getBuildInfo() }));
  }

  @Get(HEALTH.READY)
  @HealthCheck()
  async readiness() {
    const results = await Promise.allSettled(
      this.upstreams.map(({ key, indicator }) => indicator.isHealthy(key)),
    );

    return this.health.check(
      results.map((result) => (): Promise<HealthIndicatorResult> => {
        if (result.status === 'fulfilled') {
          return Promise.resolve(result.value);
        }
        throw result.reason;
      }),
    );
  }
}
