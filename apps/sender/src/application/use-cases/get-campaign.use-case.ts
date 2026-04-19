import { Inject, Injectable } from '@nestjs/common';
import type { GetCampaignCommand } from '../commands/get-campaign.command';
import type { GetCampaignResult } from '../ports/inbound/get-campaign.port';
import type { CampaignRepositoryPort } from '../ports/outbound/campaign-repository.port';
import { CAMPAIGN_REPOSITORY_PORT } from '../../sender.constants';

@Injectable()
export class GetCampaignUseCase {
  constructor(
    @Inject(CAMPAIGN_REPOSITORY_PORT)
    private readonly campaignRepository: CampaignRepositoryPort,
  ) {}

  async execute(_cmd: GetCampaignCommand): Promise<GetCampaignResult> {
    throw new Error('GetCampaignUseCase not yet implemented');
  }
}
