import { Injectable } from '@nestjs/common';
import type { ListCampaignsPort, ListCampaignsResult } from '../ports/inbound/list-campaigns.port';
import type { ListCampaignsCommand } from '../commands/list-campaigns.command';
import { ListCampaignsUseCase } from '../use-cases/list-campaigns.use-case';

@Injectable()
export class ListCampaignsService implements ListCampaignsPort {
  constructor(private readonly listCampaigns: ListCampaignsUseCase) {}

  async execute(cmd: ListCampaignsCommand): Promise<ListCampaignsResult> {
    return this.listCampaigns.execute(cmd);
  }
}
