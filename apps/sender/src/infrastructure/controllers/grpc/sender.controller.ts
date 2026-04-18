import { Controller, Inject } from '@nestjs/common';
import { SenderProto, CommonProto } from '@email-platform/contracts';
import type { ListCampaignsPort } from '../../../application/ports/inbound/list-campaigns.port';
import type { GetCampaignPort } from '../../../application/ports/inbound/get-campaign.port';
import type { CreateCampaignPort } from '../../../application/ports/inbound/create-campaign.port';
import type { PauseCampaignPort } from '../../../application/ports/inbound/pause-campaign.port';
import type { ResumeCampaignPort } from '../../../application/ports/inbound/resume-campaign.port';
import type { ListRunnersPort } from '../../../application/ports/inbound/list-runners.port';
import type { CreateRunnerPort } from '../../../application/ports/inbound/create-runner.port';
import type { ListMessagesPort } from '../../../application/ports/inbound/list-messages.port';
import type { CreateMessagePort } from '../../../application/ports/inbound/create-message.port';
import type { ListMacrosPort } from '../../../application/ports/inbound/list-macros.port';
import { ListCampaignsCommand } from '../../../application/commands/list-campaigns.command';
import { GetCampaignCommand } from '../../../application/commands/get-campaign.command';
import { CreateCampaignCommand } from '../../../application/commands/create-campaign.command';
import { PauseCampaignCommand } from '../../../application/commands/pause-campaign.command';
import { ResumeCampaignCommand } from '../../../application/commands/resume-campaign.command';
import { ListRunnersCommand } from '../../../application/commands/list-runners.command';
import { CreateRunnerCommand } from '../../../application/commands/create-runner.command';
import { ListMessagesCommand } from '../../../application/commands/list-messages.command';
import { CreateMessageCommand } from '../../../application/commands/create-message.command';
import { ListMacrosCommand } from '../../../application/commands/list-macros.command';
import { HEALTH } from '@email-platform/foundation';
import {
  LIST_CAMPAIGNS_PORT,
  GET_CAMPAIGN_PORT,
  CREATE_CAMPAIGN_PORT,
  PAUSE_CAMPAIGN_PORT,
  RESUME_CAMPAIGN_PORT,
  LIST_RUNNERS_PORT,
  CREATE_RUNNER_PORT,
  LIST_MESSAGES_PORT,
  CREATE_MESSAGE_PORT,
  LIST_MACROS_PORT,
  PAGINATION_DEFAULTS,
} from '../../../sender.constants';

@Controller()
@SenderProto.SenderServiceControllerMethods()
export class SenderController implements SenderProto.SenderServiceController {
  constructor(
    @Inject(LIST_CAMPAIGNS_PORT) private readonly listCampaignsPort: ListCampaignsPort,
    @Inject(GET_CAMPAIGN_PORT) private readonly getCampaignPort: GetCampaignPort,
    @Inject(CREATE_CAMPAIGN_PORT) private readonly createCampaignPort: CreateCampaignPort,
    @Inject(PAUSE_CAMPAIGN_PORT) private readonly pauseCampaignPort: PauseCampaignPort,
    @Inject(RESUME_CAMPAIGN_PORT) private readonly resumeCampaignPort: ResumeCampaignPort,
    @Inject(LIST_RUNNERS_PORT) private readonly listRunnersPort: ListRunnersPort,
    @Inject(CREATE_RUNNER_PORT) private readonly createRunnerPort: CreateRunnerPort,
    @Inject(LIST_MESSAGES_PORT) private readonly listMessagesPort: ListMessagesPort,
    @Inject(CREATE_MESSAGE_PORT) private readonly createMessagePort: CreateMessagePort,
    @Inject(LIST_MACROS_PORT) private readonly listMacrosPort: ListMacrosPort,
  ) {}

  async healthCheck(_request: CommonProto.Empty): Promise<CommonProto.HealthStatus> {
    // D-14: REST probe is the standard; gRPC health uses grpc-health-check protocol
    // registered in main.ts via createGrpcServerOptions. Stub here is acceptable.
    return { status: HEALTH.GRPC_STATUS_SERVING };
  }

  async listCampaigns(req: SenderProto.ListCampaignsRequest): Promise<SenderProto.CampaignList> {
    const page = req.pagination?.page ?? PAGINATION_DEFAULTS.PAGE;
    const limit = req.pagination?.limit ?? PAGINATION_DEFAULTS.LIMIT;
    const cmd = new ListCampaignsCommand(page, limit, req.userId);
    const result = await this.listCampaignsPort.execute(cmd);
    return {
      campaigns: result.campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        messageId: c.messageId,
        runnerId: c.runnerId,
        groupId: c.groupId,
        userId: c.userId,
        sentCount: c.sentCount,
        failedCount: c.failedCount,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        pages: result.pages,
      },
    };
  }

  async getCampaign(req: SenderProto.CampaignIdRequest): Promise<SenderProto.Campaign> {
    const cmd = new GetCampaignCommand(req.id);
    const result = await this.getCampaignPort.execute(cmd);
    return {
      id: result.id,
      name: result.name,
      status: result.status,
      messageId: result.messageId,
      runnerId: result.runnerId,
      groupId: result.groupId,
      userId: result.userId,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  async createCampaign(req: SenderProto.CreateCampaignRequest): Promise<SenderProto.Campaign> {
    const cmd = new CreateCampaignCommand(
      req.name,
      req.messageId,
      req.runnerId,
      req.groupId,
      req.userId,
    );
    const result = await this.createCampaignPort.execute(cmd);
    return {
      id: result.id,
      name: result.name,
      status: result.status,
      messageId: result.messageId,
      runnerId: result.runnerId,
      groupId: result.groupId,
      userId: result.userId,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  async pauseCampaign(req: SenderProto.CampaignIdRequest): Promise<SenderProto.Campaign> {
    const cmd = new PauseCampaignCommand(req.id);
    const result = await this.pauseCampaignPort.execute(cmd);
    return {
      id: result.id,
      name: result.name,
      status: result.status,
      messageId: result.messageId,
      runnerId: result.runnerId,
      groupId: result.groupId,
      userId: result.userId,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  async resumeCampaign(req: SenderProto.CampaignIdRequest): Promise<SenderProto.Campaign> {
    const cmd = new ResumeCampaignCommand(req.id);
    const result = await this.resumeCampaignPort.execute(cmd);
    return {
      id: result.id,
      name: result.name,
      status: result.status,
      messageId: result.messageId,
      runnerId: result.runnerId,
      groupId: result.groupId,
      userId: result.userId,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  async listRunners(req: SenderProto.ListRunnersRequest): Promise<SenderProto.RunnerList> {
    const page = req.pagination?.page ?? PAGINATION_DEFAULTS.PAGE;
    const limit = req.pagination?.limit ?? PAGINATION_DEFAULTS.LIMIT;
    const cmd = new ListRunnersCommand(page, limit);
    const result = await this.listRunnersPort.execute(cmd);
    return {
      runners: result.runners.map((r) => ({
        id: r.id,
        name: r.name,
        proxyUrl: r.proxyUrl,
        senderEmail: r.senderEmail,
        senderName: r.senderName,
        intervalSeconds: r.intervalSeconds,
        cooldownSeconds: r.cooldownSeconds,
        createdAt: r.createdAt,
      })),
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        pages: result.pages,
      },
    };
  }

  async createRunner(req: SenderProto.CreateRunnerRequest): Promise<SenderProto.Runner> {
    const cmd = new CreateRunnerCommand(
      req.name,
      req.proxyUrl,
      req.senderEmail,
      req.senderName,
      req.intervalSeconds,
      req.cooldownSeconds,
    );
    const result = await this.createRunnerPort.execute(cmd);
    return {
      id: result.id,
      name: result.name,
      proxyUrl: result.proxyUrl,
      senderEmail: result.senderEmail,
      senderName: result.senderName,
      intervalSeconds: result.intervalSeconds,
      cooldownSeconds: result.cooldownSeconds,
      createdAt: result.createdAt,
    };
  }

  async listMessages(req: SenderProto.ListMessagesRequest): Promise<SenderProto.MessageList> {
    const page = req.pagination?.page ?? PAGINATION_DEFAULTS.PAGE;
    const limit = req.pagination?.limit ?? PAGINATION_DEFAULTS.LIMIT;
    const cmd = new ListMessagesCommand(page, limit);
    const result = await this.listMessagesPort.execute(cmd);
    return {
      messages: result.messages.map((m) => ({
        id: m.id,
        subject: m.subject,
        body: m.body,
        userId: m.userId,
        createdAt: m.createdAt,
      })),
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        pages: result.pages,
      },
    };
  }

  async createMessage(req: SenderProto.CreateMessageRequest): Promise<SenderProto.Message> {
    const cmd = new CreateMessageCommand(req.subject, req.body, req.userId);
    const result = await this.createMessagePort.execute(cmd);
    return {
      id: result.id,
      subject: result.subject,
      body: result.body,
      userId: result.userId,
      createdAt: result.createdAt,
    };
  }

  async listMacros(req: SenderProto.ListMacrosRequest): Promise<SenderProto.MacrosList> {
    const page = req.pagination?.page ?? PAGINATION_DEFAULTS.PAGE;
    const limit = req.pagination?.limit ?? PAGINATION_DEFAULTS.LIMIT;
    const cmd = new ListMacrosCommand(page, limit);
    const result = await this.listMacrosPort.execute(cmd);
    return {
      macros: result.macros.map((m) => ({
        id: m.id,
        name: m.name,
        template: m.template,
        createdAt: m.createdAt,
      })),
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        pages: result.pages,
      },
    };
  }
}
