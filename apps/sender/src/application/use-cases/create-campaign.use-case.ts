import { Inject, Injectable } from '@nestjs/common';
import type { CreateCampaignCommand } from '../commands/create-campaign.command';
import type { CreateCampaignResult } from '../ports/inbound/create-campaign.port';
import type { CampaignRepositoryPort } from '../ports/outbound/campaign-repository.port';
import { CAMPAIGN_REPOSITORY_PORT } from '../../sender.constants';

@Injectable()
export class CreateCampaignUseCase {
  constructor(
    @Inject(CAMPAIGN_REPOSITORY_PORT)
    private readonly campaignRepository: CampaignRepositoryPort,
  ) {}

  async execute(_cmd: CreateCampaignCommand): Promise<CreateCampaignResult> {
    throw new Error('CreateCampaignUseCase not yet implemented');
  }
}
