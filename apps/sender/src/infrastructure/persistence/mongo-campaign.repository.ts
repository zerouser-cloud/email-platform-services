import { Injectable, NotImplementedException } from '@nestjs/common';
import { Campaign } from '../../domain/entities/campaign.entity';
import { CampaignRepositoryPort } from '../../application/ports/outbound/campaign-repository.port';

@Injectable()
export class MongoCampaignRepository implements CampaignRepositoryPort {
  async findById(_id: string): Promise<Campaign | null> {
    throw new NotImplementedException(
      'MongoCampaignRepository.findById not yet implemented',
    );
  }

  async save(_campaign: Campaign): Promise<void> {
    throw new NotImplementedException(
      'MongoCampaignRepository.save not yet implemented',
    );
  }
}
