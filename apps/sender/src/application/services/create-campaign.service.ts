import { Injectable } from '@nestjs/common';
import type {
  CreateCampaignPort,
  CreateCampaignResult,
} from '../ports/inbound/create-campaign.port';
import type { CreateCampaignCommand } from '../commands/create-campaign.command';
import { CreateCampaignUseCase } from '../use-cases/create-campaign.use-case';

@Injectable()
export class CreateCampaignService implements CreateCampaignPort {
  constructor(private readonly useCase: CreateCampaignUseCase) {}

  async execute(cmd: CreateCampaignCommand): Promise<CreateCampaignResult> {
    return this.useCase.execute(cmd);
  }
}
