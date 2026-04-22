import type { ListCampaignsCommand } from '../../commands/list-campaigns.command';

export interface ListCampaignsPort {
  execute(cmd: ListCampaignsCommand): Promise<ListCampaignsResult>;
}

export interface ListCampaignsResult {
  readonly campaigns: ReadonlyArray<{
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
  }>;
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly pages: number;
}
