import { Module } from '@nestjs/common';
import { CampaignModule } from './campaign';

/**
 * AppPersistenceModule (Phase 999.11.2 D-06) — app-level composer aggregating
 * per-aggregate persistence sub-modules. Single-sub today (campaign) but the
 * composer layer stays per D-06 verbatim so future aggregates (future phase)
 * are added by editing this imports/exports array without restructuring the
 * composition root.
 *
 * `App` prefix disambiguates from foundation's `PersistenceModule` inside
 * sender.module.ts imports.
 */
@Module({
  imports: [CampaignModule],
  exports: [CampaignModule],
})
export class AppPersistenceModule {}
