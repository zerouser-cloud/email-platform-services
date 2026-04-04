import { Campaign } from '../../domain/entities/campaign.entity';
import type { campaigns } from './schema/campaigns.schema';

type CampaignRow = typeof campaigns.$inferSelect;
type NewCampaignRow = typeof campaigns.$inferInsert;

export const CampaignMapper = {
  toDomain(row: CampaignRow): Campaign {
    return new Campaign(row.id, row.name, row.status);
  },

  toPersistence(campaign: Campaign): NewCampaignRow {
    return {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
    };
  },
};
