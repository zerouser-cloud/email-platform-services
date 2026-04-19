import { Injectable } from '@nestjs/common';
import type { GetCampaignPort, GetCampaignResult } from '../ports/inbound/get-campaign.port';
import type { GetCampaignCommand } from '../commands/get-campaign.command';
import { GetCampaignUseCase } from '../use-cases/get-campaign.use-case';

@Injectable()
export class GetCampaignService implements GetCampaignPort {
  constructor(private readonly getCampaign: GetCampaignUseCase) {}

  async execute(cmd: GetCampaignCommand): Promise<GetCampaignResult> {
    return this.getCampaign.execute(cmd);
  }
}
