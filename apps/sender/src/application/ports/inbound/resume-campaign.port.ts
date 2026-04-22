import type { ResumeCampaignCommand } from '../../commands/resume-campaign.command';

export interface ResumeCampaignPort {
  execute(cmd: ResumeCampaignCommand): Promise<ResumeCampaignResult>;
}

export interface ResumeCampaignResult {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly messageId: string;
  readonly runnerId: string;
  readonly groupId: string;
  readonly userId: string;
  readonly sentCount: number;
  readonly failedCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}
