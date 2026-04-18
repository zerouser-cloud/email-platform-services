import { Inject, Injectable } from '@nestjs/common';
import type { Campaign } from '../../domain/entities/campaign.entity';
import type { CampaignRepositoryPort } from '../ports/outbound/campaign-repository.port';
import { CAMPAIGN_REPOSITORY_PORT } from '../../sender.constants';

/**
 * Shared atomic use case (D-03 + D-23) — invoked by both PauseCampaignService
 * (newStatus='paused') and ResumeCampaignService (newStatus='active'). Demonstrates
 * use case reuse across services within the same bounded context.
 */
export type CampaignLifecycleStatus = 'paused' | 'active';

@Injectable()
export class TransitionCampaignStatusUseCase {
  constructor(
    @Inject(CAMPAIGN_REPOSITORY_PORT)
    private readonly campaigns: CampaignRepositoryPort,
  ) {}

  async execute(_id: string, _newStatus: CampaignLifecycleStatus): Promise<Campaign> {
    throw new Error('TransitionCampaignStatusUseCase not yet implemented');
  }
}
