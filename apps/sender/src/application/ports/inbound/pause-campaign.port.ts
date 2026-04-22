import type { PauseCampaignCommand } from '../../commands/pause-campaign.command';

export interface PauseCampaignPort {
  execute(cmd: PauseCampaignCommand): Promise<PauseCampaignResult>;
}

export interface PauseCampaignResult {
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
