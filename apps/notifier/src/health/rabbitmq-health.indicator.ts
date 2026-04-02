import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';

@Injectable()
export class RabbitMQHealthIndicator extends HealthIndicator {
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    // TODO: Check actual RabbitMQ connection when transport is configured
    const result = this.getStatus(key, true);
    if (result[key]?.status === 'up') {
      return result;
    }
    throw new HealthCheckError('RabbitMQ check failed', result);
  }
}
