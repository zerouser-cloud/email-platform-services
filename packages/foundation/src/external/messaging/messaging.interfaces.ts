import type { HealthIndicatorResult } from '@nestjs/terminus';

export interface MessagingHealthIndicator {
  isHealthy(key: string): Promise<HealthIndicatorResult>;
}
