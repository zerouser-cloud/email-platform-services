import { Inject, Injectable } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { ClsService } from 'nestjs-cls';
import { SenderProto, CommonProto } from '@email-platform/contracts';
import { SERVICE } from '@email-platform/config';
import { AbstractGrpcClient } from '../abstract-grpc-client';
import type { CallOpts } from '../grpc-client-logging.types';
import { SENDER_CLIENT_GRPC } from './sender-client.constants';

@Injectable()
export class SenderClient extends AbstractGrpcClient<SenderProto.SenderServiceClient> {
  constructor(
    @Inject(SENDER_CLIENT_GRPC) grpc: ClientGrpc,
    cls: ClsService,
    defaultDeadlineMs: number,
  ) {
    super(grpc, cls, SERVICE.sender.grpc.serviceName, defaultDeadlineMs, SenderClient.name);
  }

  healthCheck(request: CommonProto.Empty, opts?: CallOpts): Promise<CommonProto.HealthStatus> {
    return this.call('healthCheck', this.raw.healthCheck(request, this.buildMetadata(opts)));
  }
  listCampaigns(
    request: SenderProto.ListCampaignsRequest,
    opts?: CallOpts,
  ): Promise<SenderProto.CampaignList> {
    return this.call('listCampaigns', this.raw.listCampaigns(request, this.buildMetadata(opts)));
  }
  getCampaign(
    request: SenderProto.CampaignIdRequest,
    opts?: CallOpts,
  ): Promise<SenderProto.Campaign> {
    return this.call('getCampaign', this.raw.getCampaign(request, this.buildMetadata(opts)));
  }
  createCampaign(
    request: SenderProto.CreateCampaignRequest,
    opts?: CallOpts,
  ): Promise<SenderProto.Campaign> {
    return this.call('createCampaign', this.raw.createCampaign(request, this.buildMetadata(opts)));
  }
  pauseCampaign(
    request: SenderProto.CampaignIdRequest,
    opts?: CallOpts,
  ): Promise<SenderProto.Campaign> {
    return this.call('pauseCampaign', this.raw.pauseCampaign(request, this.buildMetadata(opts)));
  }
  resumeCampaign(
    request: SenderProto.CampaignIdRequest,
    opts?: CallOpts,
  ): Promise<SenderProto.Campaign> {
    return this.call('resumeCampaign', this.raw.resumeCampaign(request, this.buildMetadata(opts)));
  }
  listRunners(
    request: SenderProto.ListRunnersRequest,
    opts?: CallOpts,
  ): Promise<SenderProto.RunnerList> {
    return this.call('listRunners', this.raw.listRunners(request, this.buildMetadata(opts)));
  }
  createRunner(
    request: SenderProto.CreateRunnerRequest,
    opts?: CallOpts,
  ): Promise<SenderProto.Runner> {
    return this.call('createRunner', this.raw.createRunner(request, this.buildMetadata(opts)));
  }
  listMessages(
    request: SenderProto.ListMessagesRequest,
    opts?: CallOpts,
  ): Promise<SenderProto.MessageList> {
    return this.call('listMessages', this.raw.listMessages(request, this.buildMetadata(opts)));
  }
  createMessage(
    request: SenderProto.CreateMessageRequest,
    opts?: CallOpts,
  ): Promise<SenderProto.Message> {
    return this.call('createMessage', this.raw.createMessage(request, this.buildMetadata(opts)));
  }
  listMacros(
    request: SenderProto.ListMacrosRequest,
    opts?: CallOpts,
  ): Promise<SenderProto.MacrosList> {
    return this.call('listMacros', this.raw.listMacros(request, this.buildMetadata(opts)));
  }
}
