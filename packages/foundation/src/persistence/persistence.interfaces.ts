import type { HealthIndicatorResult } from '@nestjs/terminus';

export interface DatabaseHealthIndicator {
  isHealthy(key: string): Promise<HealthIndicatorResult>;
}
