import { Campaign } from '../../../domain/entities/campaign.entity';

export interface CampaignRepositoryPort {
  findById(id: string): Promise<Campaign | null>;
  save(campaign: Campaign): Promise<void>;
}
