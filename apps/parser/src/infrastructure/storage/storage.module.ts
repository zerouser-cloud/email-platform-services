import { Module } from '@nestjs/common';
import { PublicStorageModule } from '@email-platform/foundation';
import { ParserStorageModule } from './parser-storage.module';

@Module({
  imports: [ParserStorageModule, PublicStorageModule],
  exports: [ParserStorageModule, PublicStorageModule],
})
export class StorageModule {}
