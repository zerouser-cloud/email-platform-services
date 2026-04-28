import { Module } from '@nestjs/common';
import { SharedNamespaceModule, SHARED_REPORTS, CONTENT_TYPE } from '@email-platform/foundation';

const REPORTS_NAMESPACE = 'reports';

/**
 * ReportsModule (Phase 999.11.2 D-02, D-06) — shared reports namespace
 * sub-module wrapping foundation `SharedNamespaceModule.forNamespace(...)`.
 * Extracted from the old inline composer in `infrastructure/storage/storage.module.ts`
 * into a dedicated sub-module per the canonical split; forNamespace options
 * copied verbatim (DC-06 legitimate composition preserved).
 */
@Module({
  imports: [
    SharedNamespaceModule.forNamespace({
      namespace: REPORTS_NAMESPACE,
      contentType: CONTENT_TYPE.PDF,
      token: SHARED_REPORTS,
    }),
  ],
  exports: [SharedNamespaceModule],
})
export class ReportsModule {}
