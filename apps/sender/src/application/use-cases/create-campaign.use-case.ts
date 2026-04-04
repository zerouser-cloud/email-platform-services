import { Inject, Injectable } from '@nestjs/common';
import { CreateCampaignPort, CreateCampaignResult } from '../ports/inbound/create-campaign.port';
import { CampaignRepositoryPort } from '../ports/outbound/campaign-repository.port';

@Injectable()
export class CreateCampaignUseCase implements CreateCampaignPort {
  constructor(
    @Inject('CampaignRepositoryPort')
    private readonly campaignRepository: CampaignRepositoryPort,
  ) {}

  async execute(_name: string): Promise<CreateCampaignResult> {
    throw new Error('CreateCampaignUseCase not yet implemented');
  }
}
