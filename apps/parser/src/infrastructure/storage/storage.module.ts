import { Module } from '@nestjs/common';
import { ReportsStorageModule } from '@email-platform/foundation';
import { ParserStorageModule } from './parser-storage.module';

@Module({
  imports: [ParserStorageModule, ReportsStorageModule],
  exports: [ParserStorageModule, ReportsStorageModule],
})
export class StorageModule {}
