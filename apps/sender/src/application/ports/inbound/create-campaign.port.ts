import type { CreateCampaignCommand } from '../../commands/create-campaign.command';

export interface CreateCampaignPort {
  execute(cmd: CreateCampaignCommand): Promise<CreateCampaignResult>;
}

export interface CreateCampaignResult {
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
