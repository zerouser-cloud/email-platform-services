import { Injectable } from '@nestjs/common';
import { type HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import { HeadBucketCommand, type S3Client } from '@aws-sdk/client-s3';
import { S3_HEALTH_CHECK } from './storage.constants';
import type { StorageHealthIndicator } from './storage.interfaces';

@Injectable()
export class S3HealthIndicator implements StorageHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return indicator.up();
    } catch {
      return indicator.down({ message: S3_HEALTH_CHECK.DOWN_MESSAGE });
    }
  }
}
