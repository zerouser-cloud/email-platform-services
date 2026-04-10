import { Module, type DynamicModule } from '@nestjs/common';
import { HealthIndicatorService, TerminusModule } from '@nestjs/terminus';
import type { S3Client } from '@aws-sdk/client-s3';
import { S3_CLIENT } from './storage.constants';
import { S3CoreModule } from './s3-core.module';
import type { BucketStorageOptions } from './storage.interfaces';
import { S3StorageService } from './s3-storage.service';
import { S3HealthIndicator } from './s3.health';

@Module({})
export class BucketStorageModule {
  static forBucket(options: BucketStorageOptions): DynamicModule {
    return {
      module: BucketStorageModule,
      imports: [TerminusModule, S3CoreModule],
      providers: [
        {
          provide: options.token,
          inject: [S3_CLIENT],
          useFactory: (client: S3Client): S3StorageService =>
            new S3StorageService(client, options.bucket),
        },
        {
          provide: options.healthToken,
          inject: [HealthIndicatorService, S3_CLIENT],
          useFactory: (his: HealthIndicatorService, client: S3Client): S3HealthIndicator =>
            new S3HealthIndicator(his, client, options.bucket),
        },
      ],
      exports: [TerminusModule, options.token, options.healthToken],
    };
  }
}
