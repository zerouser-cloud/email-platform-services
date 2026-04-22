import { Module } from '@nestjs/common';
import { BucketModule } from './bucket';
import { ReportsModule } from './reports';

/**
 * AppStorageModule (Phase 999.11.2 D-02, D-06, DC-06) — app-level composer for
 * parser outbound storage. Multi-sub: aggregates the private parser bucket
 * (`BucketModule`, formerly `ParserStorageModule`) and the shared reports
 * namespace (`ReportsModule`, formerly inline `SharedNamespaceModule.forNamespace`
 * in the old composer). Double-module split preserved per DC-06 (legitimate
 * composition: private bucket + shared reports).
 *
 * `App` prefix disambiguates from foundation's `StorageModule` / `SharedStorageModule`
 * inside parser.module.ts imports.
 */
@Module({
  imports: [BucketModule, ReportsModule],
  exports: [BucketModule, ReportsModule],
})
export class AppStorageModule {}
