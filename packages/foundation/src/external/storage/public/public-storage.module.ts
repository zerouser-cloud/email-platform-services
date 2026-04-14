import { Module } from '@nestjs/common';
import { BucketStorageModule } from '../../../internal/storage';
import {
  PUBLIC_STORAGE,
  PUBLIC_STORAGE_HEALTH,
  PUBLIC_BUCKET,
  PUBLIC_HEALTH_KEY,
} from './public.constants';

@Module({
  imports: [
    BucketStorageModule.forBucket({
      bucket: PUBLIC_BUCKET,
      token: PUBLIC_STORAGE,
      healthToken: PUBLIC_STORAGE_HEALTH,
      healthKey: PUBLIC_HEALTH_KEY,
    }),
  ],
  exports: [BucketStorageModule],
})
export class PublicStorageModule {}
