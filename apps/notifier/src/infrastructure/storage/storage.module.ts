import { Module } from '@nestjs/common';
import { PublicStorageModule } from '@email-platform/foundation';

@Module({
  imports: [PublicStorageModule],
  exports: [PublicStorageModule],
})
export class StorageModule {}
