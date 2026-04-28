import { Module } from '@nestjs/common';
import { AppStoreSpyClientModule } from './appstorespy';

/**
 * HttpClientsModule (Phase 999.11.2 D-06) — app-level composer for outbound
 * HTTP vendor clients. Single-sub today (appstorespy); the composer layer
 * stays per D-06 verbatim so future vendors are added by editing this
 * imports/exports array without restructuring the composition root.
 */
@Module({
  imports: [AppStoreSpyClientModule.forRoot()],
  exports: [AppStoreSpyClientModule],
})
export class HttpClientsModule {}
