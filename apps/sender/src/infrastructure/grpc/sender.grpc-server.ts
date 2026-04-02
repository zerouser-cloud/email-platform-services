import { Controller, Inject, NotImplementedException } from '@nestjs/common';
import { SenderProto, CommonProto } from '@email-platform/contracts';
import { CreateCampaignPort } from '../../application/ports/inbound/create-campaign.port';

@Controller()
@SenderProto.SenderServiceControllerMethods()
export class SenderGrpcServer implements SenderProto.SenderServiceController {
  constructor(
    @Inject('CreateCampaignPort')
    private readonly createCampaignPort: CreateCampaignPort,
  ) {}

  async healthCheck(
    _request: CommonProto.Empty,
  ): Promise<CommonProto.HealthStatus> {
    throw new NotImplementedException('healthCheck not yet implemented');
  }

  async listCampaigns(
    _request: SenderProto.ListCampaignsRequest,
  ): Promise<SenderProto.CampaignList> {
    throw new NotImplementedException('listCampaigns not yet implemented');
  }

  async getCampaign(
    _request: SenderProto.CampaignIdRequest,
  ): Promise<SenderProto.Campaign> {
    throw new NotImplementedException('getCampaign not yet implemented');
  }

  async createCampaign(
    _request: SenderProto.CreateCampaignRequest,
  ): Promise<SenderProto.Campaign> {
    throw new NotImplementedException('createCampaign not yet implemented');
  }

  async pauseCampaign(
    _request: SenderProto.CampaignIdRequest,
  ): Promise<SenderProto.Campaign> {
    throw new NotImplementedException('pauseCampaign not yet implemented');
  }

  async resumeCampaign(
    _request: SenderProto.CampaignIdRequest,
  ): Promise<SenderProto.Campaign> {
    throw new NotImplementedException('resumeCampaign not yet implemented');
  }

  async listRunners(
    _request: SenderProto.ListRunnersRequest,
  ): Promise<SenderProto.RunnerList> {
    throw new NotImplementedException('listRunners not yet implemented');
  }

  async createRunner(
    _request: SenderProto.CreateRunnerRequest,
  ): Promise<SenderProto.Runner> {
    throw new NotImplementedException('createRunner not yet implemented');
  }

  async listMessages(
    _request: SenderProto.ListMessagesRequest,
  ): Promise<SenderProto.MessageList> {
    throw new NotImplementedException('listMessages not yet implemented');
  }

  async createMessage(
    _request: SenderProto.CreateMessageRequest,
  ): Promise<SenderProto.Message> {
    throw new NotImplementedException('createMessage not yet implemented');
  }

  async listMacros(
    _request: SenderProto.ListMacrosRequest,
  ): Promise<SenderProto.MacrosList> {
    throw new NotImplementedException('listMacros not yet implemented');
  }
}
