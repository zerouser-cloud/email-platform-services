import { Module } from '@nestjs/common';
import { SharedNamespaceModule, SHARED_REPORTS, CONTENT_TYPE } from '@email-platform/foundation';
import { ParserStorageModule } from './parser-storage.module';

const REPORTS_NAMESPACE = 'reports';

@Module({
  imports: [
    ParserStorageModule,
    SharedNamespaceModule.forNamespace({
      namespace: REPORTS_NAMESPACE,
      contentType: CONTENT_TYPE.PDF,
      token: SHARED_REPORTS,
    }),
  ],
  exports: [ParserStorageModule, SharedNamespaceModule],
})
export class StorageModule {}
