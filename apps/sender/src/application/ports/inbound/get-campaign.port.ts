import type { GetCampaignCommand } from '../../commands/get-campaign.command';

export interface GetCampaignPort {
  execute(cmd: GetCampaignCommand): Promise<GetCampaignResult>;
}

export interface GetCampaignResult {
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
