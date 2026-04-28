import { Module } from '@nestjs/common';
import {
  SharedNamespaceModule,
  SHARED_REPORTS,
  PUBLIC_STORAGE_HEALTH,
  CONTENT_TYPE,
} from '@email-platform/foundation';

const REPORTS_NAMESPACE = 'reports';

/**
 * ReportsModule (Phase 999.11.2 D-02, D-06) — shared reports namespace
 * sub-module wrapping foundation `SharedNamespaceModule.forNamespace(...)`.
 * forNamespace options preserved verbatim (namespace: 'reports',
 * contentType: PDF, token: SHARED_REPORTS, healthToken: PUBLIC_STORAGE_HEALTH) —
 * notifier uses the public storage health propagation via `PUBLIC_STORAGE_HEALTH`
 * (mirrors the parser reports sub-module shape, adding the healthToken arg
 * that parser omits).
 */
@Module({
  imports: [
    SharedNamespaceModule.forNamespace({
      namespace: REPORTS_NAMESPACE,
      contentType: CONTENT_TYPE.PDF,
      token: SHARED_REPORTS,
      healthToken: PUBLIC_STORAGE_HEALTH,
    }),
  ],
  exports: [SharedNamespaceModule],
})
export class ReportsModule {}
