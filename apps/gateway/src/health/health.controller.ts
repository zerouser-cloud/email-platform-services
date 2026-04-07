import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthCheckService, HealthCheck, GRPCHealthIndicator } from '@nestjs/terminus';
import { type GrpcOptions } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { SERVICE } from '@email-platform/config';
import { HEALTH } from '@email-platform/foundation';

const checkOverallHealth = (healthService: {
  check: (data: { service: string }) => { toPromise: () => Promise<unknown> };
}) => healthService.check({ service: HEALTH.GRPC_SERVICE_OVERALL }).toPromise();

@SkipThrottle()
@Controller(HEALTH.ROUTE)
export class HealthController {
  private readonly grpcServices: ReadonlyArray<{ key: string; url: string }>;

  constructor(
    private readonly health: HealthCheckService,
    private readonly grpc: GRPCHealthIndicator,
    private readonly configService: ConfigService,
  ) {
    this.grpcServices = [
      {
        key: SERVICE.auth.id,
        url: this.configService.get<string>(SERVICE.auth.envKeys.GRPC_URL!) ?? '',
      },
      {
        key: SERVICE.sender.id,
        url: this.configService.get<string>(SERVICE.sender.envKeys.GRPC_URL!) ?? '',
      },
      {
        key: SERVICE.parser.id,
        url: this.configService.get<string>(SERVICE.parser.envKeys.GRPC_URL!) ?? '',
      },
      {
        key: SERVICE.audience.id,
        url: this.configService.get<string>(SERVICE.audience.envKeys.GRPC_URL!) ?? '',
      },
    ];
  }

  @Get(HEALTH.LIVE)
  @HealthCheck()
  liveness() {
    return this.health
      .check([])
      .then((result) => ({ ...result, code_env: process.env.COOLIFY_BRANCH ?? 'local' }));
  }

  @Get(HEALTH.READY)
  @HealthCheck()
  async readiness() {
    const results = await Promise.allSettled(
      this.grpcServices.map(({ key, url }) =>
        this.grpc.checkService<GrpcOptions>(key, key, {
          url,
          timeout: HEALTH.CHECK_TIMEOUT,
          healthServiceCheck: checkOverallHealth,
        }),
      ),
    );

    return this.health.check(
      results.map((result) => () => {
        if (result.status === 'fulfilled') {
          return result.value;
        }
        throw result.reason;
      }),
    );
  }
}
