import { Controller, Get, Inject } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthCheckService, HealthCheck, type HealthIndicatorResult } from '@nestjs/terminus';
import {
  HEALTH,
  CACHE_HEALTH,
  getBuildInfo,
  GrpcClientHealthIndicator,
} from '@email-platform/foundation';
import type { CacheHealthIndicator } from '@email-platform/foundation';
import {
  AUTH_GRPC_HEALTH,
  SENDER_GRPC_HEALTH,
  PARSER_GRPC_HEALTH,
  AUDIENCE_GRPC_HEALTH,
  NOTIFIER_GRPC_HEALTH,
} from '../../outbound/grpc-clients';
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
    @Inject(CACHE_HEALTH) private readonly cache: CacheHealthIndicator,
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

  /**
   * Readiness probe (Phase 999.12 D-05/D-20 — Option B locked at plan time).
   *
   * Two-stage composition:
   *   1. Promise.allSettled fan-out across the 5 upstream gRPC indicators
   *      (`upstreams[]`). The element type stays narrow
   *      (`{ key: string; indicator: GrpcClientHealthIndicator }`) — Option A
   *      (widen the union to also accept CacheHealthIndicator and push redis
   *      as a 6th element) was considered and rejected per planner revision
   *      iter-1: it dilutes the array's semantic meaning ("upstream gRPC
   *      services") and creates downstream awkwardness for any code
   *      pattern-matching on GrpcClientHealthIndicator specifics.
   *   2. A separate sequential `this.health.check([...])` for the Redis
   *      indicator. Terminus merges the resulting `info.redis` /
   *      `details.redis` slot into the response object alongside the
   *      upstreams-derived results — same shape as a single uniform
   *      `health.check([...])` call from the caller's POV.
   */
  @Get(HEALTH.READY)
  @HealthCheck()
  async readiness() {
    const results = await Promise.allSettled(
      this.upstreams.map(({ key, indicator }) => indicator.isHealthy(key)),
    );

    const upstreamsResult = await this.health.check(
      results.map((result) => (): Promise<HealthIndicatorResult> => {
        if (result.status === 'fulfilled') {
          return Promise.resolve(result.value);
        }
        throw result.reason;
      }),
    );

    const redisResult = await this.health.check([
      () => this.cache.isHealthy(HEALTH.INDICATOR.REDIS),
    ]);

    return {
      ...upstreamsResult,
      info: { ...(upstreamsResult.info ?? {}), ...(redisResult.info ?? {}) },
      details: { ...(upstreamsResult.details ?? {}), ...(redisResult.details ?? {}) },
    };
  }
}
