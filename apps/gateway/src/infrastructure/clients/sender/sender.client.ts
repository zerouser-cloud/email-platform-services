import type { ClientGrpc } from '@nestjs/microservices';
import { SenderProto, CommonProto } from '@email-platform/contracts';
import { SERVICE } from '@email-platform/config';
import type { GrpcCaller, CallOpts } from '@email-platform/foundation';

export class SenderClient {
  private readonly raw: SenderProto.SenderServiceClient;

  constructor(
    grpcClient: ClientGrpc,
    private readonly grpc: GrpcCaller,
  ) {
    this.raw = grpcClient.getService<SenderProto.SenderServiceClient>(
      SERVICE.sender.grpc.serviceName,
    );
  }

  healthCheck(req: CommonProto.Empty, opts?: CallOpts): Promise<CommonProto.HealthStatus> {
    return this.grpc.call('healthCheck', opts, (m) => this.raw.healthCheck(req, m));
  }
  listCampaigns(
    req: SenderProto.ListCampaignsRequest,
    opts?: CallOpts,
  ): Promise<SenderProto.CampaignList> {
    return this.grpc.call('listCampaigns', opts, (m) => this.raw.listCampaigns(req, m));
  }
  getCampaign(req: SenderProto.CampaignIdRequest, opts?: CallOpts): Promise<SenderProto.Campaign> {
    return this.grpc.call('getCampaign', opts, (m) => this.raw.getCampaign(req, m));
  }
  createCampaign(
    req: SenderProto.CreateCampaignRequest,
    opts?: CallOpts,
  ): Promise<SenderProto.Campaign> {
    return this.grpc.call('createCampaign', opts, (m) => this.raw.createCampaign(req, m));
  }
  pauseCampaign(
    req: SenderProto.CampaignIdRequest,
    opts?: CallOpts,
  ): Promise<SenderProto.Campaign> {
    return this.grpc.call('pauseCampaign', opts, (m) => this.raw.pauseCampaign(req, m));
  }
  resumeCampaign(
    req: SenderProto.CampaignIdRequest,
    opts?: CallOpts,
  ): Promise<SenderProto.Campaign> {
    return this.grpc.call('resumeCampaign', opts, (m) => this.raw.resumeCampaign(req, m));
  }
  listRunners(
    req: SenderProto.ListRunnersRequest,
    opts?: CallOpts,
  ): Promise<SenderProto.RunnerList> {
    return this.grpc.call('listRunners', opts, (m) => this.raw.listRunners(req, m));
  }
  createRunner(req: SenderProto.CreateRunnerRequest, opts?: CallOpts): Promise<SenderProto.Runner> {
    return this.grpc.call('createRunner', opts, (m) => this.raw.createRunner(req, m));
  }
  listMessages(
    req: SenderProto.ListMessagesRequest,
    opts?: CallOpts,
  ): Promise<SenderProto.MessageList> {
    return this.grpc.call('listMessages', opts, (m) => this.raw.listMessages(req, m));
  }
  createMessage(
    req: SenderProto.CreateMessageRequest,
    opts?: CallOpts,
  ): Promise<SenderProto.Message> {
    return this.grpc.call('createMessage', opts, (m) => this.raw.createMessage(req, m));
  }
  listMacros(req: SenderProto.ListMacrosRequest, opts?: CallOpts): Promise<SenderProto.MacrosList> {
    return this.grpc.call('listMacros', opts, (m) => this.raw.listMacros(req, m));
  }
}
