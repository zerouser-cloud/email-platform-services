import { Inject, Injectable } from '@nestjs/common';
import type { ListCampaignsCommand } from '../commands/list-campaigns.command';
import type { ListCampaignsResult } from '../ports/inbound/list-campaigns.port';
import type { CampaignRepositoryPort } from '../ports/outbound/campaign-repository.port';
import { CAMPAIGN_REPOSITORY_PORT } from '../../sender.constants';

@Injectable()
export class ListCampaignsUseCase {
  constructor(
    @Inject(CAMPAIGN_REPOSITORY_PORT)
    private readonly campaigns: CampaignRepositoryPort,
  ) {}

  async execute(_cmd: ListCampaignsCommand): Promise<ListCampaignsResult> {
    throw new Error('ListCampaignsUseCase not yet implemented');
  }
}
