import { Module } from '@nestjs/common';
import { BucketStorageModule, S3CoreModule } from '../../../internal/storage';
import {
  REPORTS_STORAGE,
  REPORTS_STORAGE_HEALTH,
  REPORTS_BUCKET,
  REPORTS_HEALTH_KEY,
} from './reports.constants';

@Module({
  imports: [
    S3CoreModule,
    BucketStorageModule.forBucket({
      bucket: REPORTS_BUCKET,
      token: REPORTS_STORAGE,
      healthToken: REPORTS_STORAGE_HEALTH,
      healthKey: REPORTS_HEALTH_KEY,
    }),
  ],
  exports: [REPORTS_STORAGE, REPORTS_STORAGE_HEALTH],
})
export class ReportsStorageModule {}
