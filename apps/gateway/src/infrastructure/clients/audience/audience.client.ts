import { Inject, Injectable } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { ClsService } from 'nestjs-cls';
import { AudienceProto, CommonProto } from '@email-platform/contracts';
import { SERVICE } from '@email-platform/config';
import { AbstractGrpcClient } from '@email-platform/foundation';
import type { CallOpts } from '@email-platform/foundation';
import { AUDIENCE_CLIENT_GRPC } from './audience-client.constants';

@Injectable()
export class AudienceClient extends AbstractGrpcClient<AudienceProto.AudienceServiceClient> {
  constructor(
    @Inject(AUDIENCE_CLIENT_GRPC) grpc: ClientGrpc,
    cls: ClsService,
    defaultDeadlineMs: number,
  ) {
    super(grpc, cls, SERVICE.audience.grpc.serviceName, defaultDeadlineMs, AudienceClient.name);
  }

  healthCheck(request: CommonProto.Empty, opts?: CallOpts): Promise<CommonProto.HealthStatus> {
    return this.call('healthCheck', this.raw.healthCheck(request, this.buildMetadata(opts)));
  }
  listGroups(
    request: AudienceProto.ListGroupsRequest,
    opts?: CallOpts,
  ): Promise<AudienceProto.GroupList> {
    return this.call('listGroups', this.raw.listGroups(request, this.buildMetadata(opts)));
  }
  createGroup(
    request: AudienceProto.CreateGroupRequest,
    opts?: CallOpts,
  ): Promise<AudienceProto.Group> {
    return this.call('createGroup', this.raw.createGroup(request, this.buildMetadata(opts)));
  }
  deleteGroup(request: AudienceProto.GroupIdRequest, opts?: CallOpts): Promise<CommonProto.Empty> {
    return this.call('deleteGroup', this.raw.deleteGroup(request, this.buildMetadata(opts)));
  }
  listRecipients(
    request: AudienceProto.ListRecipientsRequest,
    opts?: CallOpts,
  ): Promise<AudienceProto.RecipientList> {
    return this.call('listRecipients', this.raw.listRecipients(request, this.buildMetadata(opts)));
  }
  getRecipientsByGroup(
    request: AudienceProto.GetByGroupRequest,
    opts?: CallOpts,
  ): Promise<AudienceProto.RecipientList> {
    return this.call(
      'getRecipientsByGroup',
      this.raw.getRecipientsByGroup(request, this.buildMetadata(opts)),
    );
  }
  importRecipients(
    request: AudienceProto.ImportRecipientsRequest,
    opts?: CallOpts,
  ): Promise<AudienceProto.ImportResult> {
    return this.call(
      'importRecipients',
      this.raw.importRecipients(request, this.buildMetadata(opts)),
    );
  }
  markAsSent(request: AudienceProto.MarkSentRequest, opts?: CallOpts): Promise<CommonProto.Empty> {
    return this.call('markAsSent', this.raw.markAsSent(request, this.buildMetadata(opts)));
  }
  resetSendStatus(
    request: AudienceProto.ResetStatusRequest,
    opts?: CallOpts,
  ): Promise<CommonProto.Empty> {
    return this.call(
      'resetSendStatus',
      this.raw.resetSendStatus(request, this.buildMetadata(opts)),
    );
  }
}
