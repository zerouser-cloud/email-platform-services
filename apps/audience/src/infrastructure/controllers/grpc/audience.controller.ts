import { Controller, Inject } from '@nestjs/common';
import { AudienceProto, CommonProto } from '@email-platform/contracts';
import type { ListGroupsPort } from '../../../application/ports/inbound/list-groups.port';
import type { CreateGroupPort } from '../../../application/ports/inbound/create-group.port';
import type { DeleteGroupPort } from '../../../application/ports/inbound/delete-group.port';
import type { ListRecipientsPort } from '../../../application/ports/inbound/list-recipients.port';
import type { GetRecipientsByGroupPort } from '../../../application/ports/inbound/get-recipients-by-group.port';
import type { ImportRecipientsPort } from '../../../application/ports/inbound/import-recipients.port';
import type { MarkAsSentPort } from '../../../application/ports/inbound/mark-as-sent.port';
import type { ResetSendStatusPort } from '../../../application/ports/inbound/reset-send-status.port';
import { ListGroupsCommand } from '../../../application/commands/list-groups.command';
import { CreateGroupCommand } from '../../../application/commands/create-group.command';
import { DeleteGroupCommand } from '../../../application/commands/delete-group.command';
import { ListRecipientsCommand } from '../../../application/commands/list-recipients.command';
import { GetRecipientsByGroupCommand } from '../../../application/commands/get-recipients-by-group.command';
import { ImportRecipientsCommand } from '../../../application/commands/import-recipients.command';
import { MarkAsSentCommand } from '../../../application/commands/mark-as-sent.command';
import { ResetSendStatusCommand } from '../../../application/commands/reset-send-status.command';
import { HEALTH } from '@email-platform/foundation';
import {
  LIST_GROUPS_PORT,
  CREATE_GROUP_PORT,
  DELETE_GROUP_PORT,
  LIST_RECIPIENTS_PORT,
  GET_RECIPIENTS_BY_GROUP_PORT,
  IMPORT_RECIPIENTS_PORT,
  MARK_AS_SENT_PORT,
  RESET_SEND_STATUS_PORT,
  PAGINATION_DEFAULTS,
} from '../../../audience.constants';

@Controller()
@AudienceProto.AudienceServiceControllerMethods()
export class AudienceController implements AudienceProto.AudienceServiceController {
  constructor(
    @Inject(LIST_GROUPS_PORT) private readonly listGroupsPort: ListGroupsPort,
    @Inject(CREATE_GROUP_PORT) private readonly createGroupPort: CreateGroupPort,
    @Inject(DELETE_GROUP_PORT) private readonly deleteGroupPort: DeleteGroupPort,
    @Inject(LIST_RECIPIENTS_PORT) private readonly listRecipientsPort: ListRecipientsPort,
    @Inject(GET_RECIPIENTS_BY_GROUP_PORT)
    private readonly getRecipientsByGroupPort: GetRecipientsByGroupPort,
    @Inject(IMPORT_RECIPIENTS_PORT) private readonly importRecipientsPort: ImportRecipientsPort,
    @Inject(MARK_AS_SENT_PORT) private readonly markAsSentPort: MarkAsSentPort,
    @Inject(RESET_SEND_STATUS_PORT) private readonly resetSendStatusPort: ResetSendStatusPort,
  ) {}

  async healthCheck(_request: CommonProto.Empty): Promise<CommonProto.HealthStatus> {
    // D-14: REST probe is the standard; gRPC health uses grpc-health-check protocol
    // registered in main.ts via createGrpcServerOptions. Stub here is acceptable.
    return { status: HEALTH.GRPC_STATUS_SERVING };
  }

  async listGroups(req: AudienceProto.ListGroupsRequest): Promise<AudienceProto.GroupList> {
    const page = req.pagination?.page ?? PAGINATION_DEFAULTS.PAGE;
    const limit = req.pagination?.limit ?? PAGINATION_DEFAULTS.LIMIT;
    const cmd = new ListGroupsCommand(page, limit, req.userId);
    const result = await this.listGroupsPort.execute(cmd);
    return {
      groups: result.groups.map((g) => ({
        id: g.id,
        name: g.name,
        recipientCount: g.recipientCount,
        userId: g.userId,
        createdAt: g.createdAt,
      })),
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        pages: result.pages,
      },
    };
  }

  async createGroup(req: AudienceProto.CreateGroupRequest): Promise<AudienceProto.Group> {
    const cmd = new CreateGroupCommand(req.name, req.userId);
    const result = await this.createGroupPort.execute(cmd);
    return {
      id: result.id,
      name: result.name,
      recipientCount: result.recipientCount,
      userId: result.userId,
      createdAt: result.createdAt,
    };
  }

  async deleteGroup(req: AudienceProto.GroupIdRequest): Promise<CommonProto.Empty> {
    const cmd = new DeleteGroupCommand(req.id);
    await this.deleteGroupPort.execute(cmd);
    return {};
  }

  async listRecipients(
    req: AudienceProto.ListRecipientsRequest,
  ): Promise<AudienceProto.RecipientList> {
    const page = req.pagination?.page ?? PAGINATION_DEFAULTS.PAGE;
    const limit = req.pagination?.limit ?? PAGINATION_DEFAULTS.LIMIT;
    const cmd = new ListRecipientsCommand(page, limit, req.groupId);
    const result = await this.listRecipientsPort.execute(cmd);
    return {
      recipients: result.recipients.map((r) => ({
        id: r.id,
        email: r.email,
        name: r.name,
        company: r.company,
        groupId: r.groupId,
        isSent: r.isSent,
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

  async getRecipientsByGroup(
    req: AudienceProto.GetByGroupRequest,
  ): Promise<AudienceProto.RecipientList> {
    const cmd = new GetRecipientsByGroupCommand(req.groupId, req.onlyUnsent);
    const result = await this.getRecipientsByGroupPort.execute(cmd);
    return {
      recipients: result.recipients.map((r) => ({
        id: r.id,
        email: r.email,
        name: r.name,
        company: r.company,
        groupId: r.groupId,
        isSent: r.isSent,
        createdAt: r.createdAt,
      })),
      // `RecipientList.pagination` is optional in the proto; omit for the
      // group-scoped query which returns the full unpaged slice.
      pagination: undefined,
    };
  }

  async importRecipients(
    req: AudienceProto.ImportRecipientsRequest,
  ): Promise<AudienceProto.ImportResult> {
    const cmd = new ImportRecipientsCommand(
      req.groupId,
      req.recipients.map((r) => ({
        email: r.email,
        name: r.name,
        company: r.company,
      })),
    );
    const result = await this.importRecipientsPort.execute(cmd);
    return {
      imported: result.imported,
      duplicates: result.duplicates,
      total: result.total,
    };
  }

  async markAsSent(req: AudienceProto.MarkSentRequest): Promise<CommonProto.Empty> {
    const cmd = new MarkAsSentCommand(req.recipientIds);
    await this.markAsSentPort.execute(cmd);
    return {};
  }

  async resetSendStatus(req: AudienceProto.ResetStatusRequest): Promise<CommonProto.Empty> {
    const cmd = new ResetSendStatusCommand(req.groupId);
    await this.resetSendStatusPort.execute(cmd);
    return {};
  }
}
