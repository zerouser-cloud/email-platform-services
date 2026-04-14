import { Module } from '@nestjs/common';
import {
  SharedNamespaceModule,
  SHARED_REPORTS,
  PUBLIC_BUCKET_HEALTH,
  CONTENT_TYPE,
} from '@email-platform/foundation';

const REPORTS_NAMESPACE = 'reports';

@Module({
  imports: [
    SharedNamespaceModule.forNamespace({
      namespace: REPORTS_NAMESPACE,
      contentType: CONTENT_TYPE.PDF,
      token: SHARED_REPORTS,
      healthToken: PUBLIC_BUCKET_HEALTH,
    }),
  ],
  exports: [SharedNamespaceModule],
})
export class StorageModule {}
