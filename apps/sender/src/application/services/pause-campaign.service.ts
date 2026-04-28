import { Injectable } from '@nestjs/common';
import type { PauseCampaignPort, PauseCampaignResult } from '../ports/inbound/pause-campaign.port';
import type { PauseCampaignCommand } from '../commands/pause-campaign.command';
import { TransitionCampaignStatusUseCase } from '../use-cases/transition-campaign-status.use-case';

@Injectable()
export class PauseCampaignService implements PauseCampaignPort {
  constructor(private readonly transitionCampaignStatus: TransitionCampaignStatusUseCase) {}

  async execute(cmd: PauseCampaignCommand): Promise<PauseCampaignResult> {
    const updated = await this.transitionCampaignStatus.execute(cmd.id, 'paused');
    // Minimal projection — business-logic phase will populate the remaining
    // proto fields (messageId/runnerId/etc) once the Campaign entity gains them.
    return {
      id: updated.id,
      name: updated.name,
      status: updated.status,
      messageId: '',
      runnerId: '',
      groupId: '',
      userId: '',
      sentCount: 0,
      failedCount: 0,
      createdAt: '',
      updatedAt: '',
    };
  }
}
