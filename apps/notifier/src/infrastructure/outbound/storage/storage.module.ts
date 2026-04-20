import { Module } from '@nestjs/common';
import { ReportsModule } from './reports';

/**
 * AppStorageModule (Phase 999.11.2 D-02, D-06, OQ-2) — app-level composer for
 * notifier outbound storage. Single-sub today (ReportsModule, shared reports
 * namespace); composer layer kept per D-06 verbatim so future notifier-scoped
 * buckets are added by editing this imports/exports array without restructuring
 * the composition root. OQ-2 resolved in favour of honouring D-06 verbatim.
 *
 * `App` prefix disambiguates from foundation's `StorageModule` / `SharedStorageModule`
 * inside the root `notifier.module.ts` imports array.
 */
@Module({
  imports: [ReportsModule],
  exports: [ReportsModule],
})
export class AppStorageModule {}
