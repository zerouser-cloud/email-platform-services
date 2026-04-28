import { Module } from '@nestjs/common';
import { PersistenceModule } from '@email-platform/foundation';
import { CAMPAIGN_REPOSITORY_PORT } from '../../../../sender.constants';
import { PgCampaignRepository } from './pg-campaign.repository';

/**
 * CampaignModule (Phase 999.11.2 D-02, D-06) — per-aggregate persistence
 * sub-module. Owns `CAMPAIGN_REPOSITORY_PORT` → `PgCampaignRepository` binding
 * and explicitly imports foundation `PersistenceModule.forRootAsync()` so the
 * repository's `@Inject(DRIZZLE)` resolves without relying on root-level
 * propagation (foundation's module is NOT `@Global()`).
 */
@Module({
  imports: [PersistenceModule.forRootAsync()],
  providers: [{ provide: CAMPAIGN_REPOSITORY_PORT, useClass: PgCampaignRepository }],
  exports: [CAMPAIGN_REPOSITORY_PORT],
})
export class CampaignModule {}
