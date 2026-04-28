import { Injectable, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus';
import { Metadata } from '@grpc/grpc-js';
import { type Observable, lastValueFrom } from 'rxjs';
import { GRPC_CLIENT_HEALTH } from './clients.constants';

interface HealthCheckRequest {
  service: string;
}

interface HealthCheckResponse {
  status: number;
}

interface HealthClient {
  Check(request: HealthCheckRequest, metadata?: Metadata): Observable<HealthCheckResponse>;
}

@Injectable()
export class GrpcClientHealthIndicator implements OnModuleInit {
  private healthRaw!: HealthClient;

  constructor(
    private readonly his: HealthIndicatorService,
    private readonly grpc: ClientGrpc,
  ) {}

  onModuleInit(): void {
    this.healthRaw = this.grpc.getService<HealthClient>(GRPC_CLIENT_HEALTH.SERVICE_NAME);
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.his.check(key);
    try {
      const response = await lastValueFrom(
        this.healthRaw.Check({ service: GRPC_CLIENT_HEALTH.OVERALL_SERVICE_KEY }),
      );
      return response.status === GRPC_CLIENT_HEALTH.STATUS_SERVING
        ? indicator.up()
        : indicator.down({ message: GRPC_CLIENT_HEALTH.DOWN_MESSAGE });
    } catch {
      return indicator.down({ message: GRPC_CLIENT_HEALTH.DOWN_MESSAGE });
    }
  }
}
