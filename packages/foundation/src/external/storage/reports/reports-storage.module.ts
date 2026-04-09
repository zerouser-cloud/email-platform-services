import { Module } from '@nestjs/common';
import { BucketStorageModule } from '../../../internal/storage';
import {
  REPORTS_STORAGE,
  REPORTS_STORAGE_HEALTH,
  REPORTS_BUCKET,
  REPORTS_HEALTH_KEY,
} from './reports.constants';

@Module({
  imports: [
    BucketStorageModule.forBucket({
      bucket: REPORTS_BUCKET,
      token: REPORTS_STORAGE,
      healthToken: REPORTS_STORAGE_HEALTH,
      healthKey: REPORTS_HEALTH_KEY,
    }),
  ],
  exports: [BucketStorageModule],
})
export class ReportsStorageModule {}
