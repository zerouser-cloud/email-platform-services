import { Module } from '@nestjs/common';
import { ReportsStorageModule } from '@email-platform/foundation';

@Module({
  imports: [ReportsStorageModule],
  exports: [ReportsStorageModule],
})
export class StorageModule {}
