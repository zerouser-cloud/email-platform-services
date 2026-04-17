import type { ClientGrpc } from '@nestjs/microservices';
import { AudienceProto, CommonProto } from '@email-platform/contracts';
import { SERVICE } from '@email-platform/config';
import type { GrpcCaller, CallOpts } from '@email-platform/foundation';

export class AudienceClient {
  private readonly raw: AudienceProto.AudienceServiceClient;

  constructor(
    grpcClient: ClientGrpc,
    private readonly grpc: GrpcCaller,
  ) {
    this.raw = grpcClient.getService<AudienceProto.AudienceServiceClient>(
      SERVICE.audience.grpc.serviceName,
    );
  }

  healthCheck(req: CommonProto.Empty, opts?: CallOpts): Promise<CommonProto.HealthStatus> {
    return this.grpc.call('healthCheck', opts, (m) => this.raw.healthCheck(req, m));
  }
  listGroups(
    req: AudienceProto.ListGroupsRequest,
    opts?: CallOpts,
  ): Promise<AudienceProto.GroupList> {
    return this.grpc.call('listGroups', opts, (m) => this.raw.listGroups(req, m));
  }
  createGroup(
    req: AudienceProto.CreateGroupRequest,
    opts?: CallOpts,
  ): Promise<AudienceProto.Group> {
    return this.grpc.call('createGroup', opts, (m) => this.raw.createGroup(req, m));
  }
  deleteGroup(req: AudienceProto.GroupIdRequest, opts?: CallOpts): Promise<CommonProto.Empty> {
    return this.grpc.call('deleteGroup', opts, (m) => this.raw.deleteGroup(req, m));
  }
  listRecipients(
    req: AudienceProto.ListRecipientsRequest,
    opts?: CallOpts,
  ): Promise<AudienceProto.RecipientList> {
    return this.grpc.call('listRecipients', opts, (m) => this.raw.listRecipients(req, m));
  }
  getRecipientsByGroup(
    req: AudienceProto.GetByGroupRequest,
    opts?: CallOpts,
  ): Promise<AudienceProto.RecipientList> {
    return this.grpc.call('getRecipientsByGroup', opts, (m) =>
      this.raw.getRecipientsByGroup(req, m),
    );
  }
  importRecipients(
    req: AudienceProto.ImportRecipientsRequest,
    opts?: CallOpts,
  ): Promise<AudienceProto.ImportResult> {
    return this.grpc.call('importRecipients', opts, (m) => this.raw.importRecipients(req, m));
  }
  markAsSent(req: AudienceProto.MarkSentRequest, opts?: CallOpts): Promise<CommonProto.Empty> {
    return this.grpc.call('markAsSent', opts, (m) => this.raw.markAsSent(req, m));
  }
  resetSendStatus(
    req: AudienceProto.ResetStatusRequest,
    opts?: CallOpts,
  ): Promise<CommonProto.Empty> {
    return this.grpc.call('resetSendStatus', opts, (m) => this.raw.resetSendStatus(req, m));
  }
}
