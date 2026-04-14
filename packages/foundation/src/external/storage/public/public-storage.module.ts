import { Module } from '@nestjs/common';
import { PrivateStorageModule } from '../../../internal/storage';
import {
  PUBLIC_STORAGE,
  PUBLIC_STORAGE_HEALTH,
  PUBLIC_BUCKET,
  PUBLIC_HEALTH_KEY,
} from './public.constants';

@Module({
  imports: [
    PrivateStorageModule.forBucket({
      bucket: PUBLIC_BUCKET,
      token: PUBLIC_STORAGE,
      healthToken: PUBLIC_STORAGE_HEALTH,
      healthKey: PUBLIC_HEALTH_KEY,
    }),
  ],
  exports: [PrivateStorageModule],
})
export class PublicStorageModule {}
