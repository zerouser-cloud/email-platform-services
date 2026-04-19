import { Injectable } from '@nestjs/common';
import type {
  ResumeCampaignPort,
  ResumeCampaignResult,
} from '../ports/inbound/resume-campaign.port';
import type { ResumeCampaignCommand } from '../commands/resume-campaign.command';
import { TransitionCampaignStatusUseCase } from '../use-cases/transition-campaign-status.use-case';

@Injectable()
export class ResumeCampaignService implements ResumeCampaignPort {
  constructor(private readonly transitionCampaignStatus: TransitionCampaignStatusUseCase) {}

  async execute(cmd: ResumeCampaignCommand): Promise<ResumeCampaignResult> {
    const updated = await this.transitionCampaignStatus.execute(cmd.id, 'active');
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
