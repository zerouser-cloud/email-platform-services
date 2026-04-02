import { Controller, Inject, NotImplementedException } from '@nestjs/common';
import { AudienceProto, CommonProto } from '@email-platform/contracts';
import { ImportRecipientsPort } from '../../application/ports/inbound/import-recipients.port';

@Controller()
@AudienceProto.AudienceServiceControllerMethods()
export class AudienceGrpcServer
  implements AudienceProto.AudienceServiceController
{
  constructor(
    @Inject('ImportRecipientsPort')
    private readonly importRecipientsPort: ImportRecipientsPort,
  ) {}

  async healthCheck(
    _request: CommonProto.Empty,
  ): Promise<CommonProto.HealthStatus> {
    throw new NotImplementedException('healthCheck not yet implemented');
  }

  async listGroups(
    _request: AudienceProto.ListGroupsRequest,
  ): Promise<AudienceProto.GroupList> {
    throw new NotImplementedException('listGroups not yet implemented');
  }

  async createGroup(
    _request: AudienceProto.CreateGroupRequest,
  ): Promise<AudienceProto.Group> {
    throw new NotImplementedException('createGroup not yet implemented');
  }

  async deleteGroup(
    _request: AudienceProto.GroupIdRequest,
  ): Promise<CommonProto.Empty> {
    throw new NotImplementedException('deleteGroup not yet implemented');
  }

  async listRecipients(
    _request: AudienceProto.ListRecipientsRequest,
  ): Promise<AudienceProto.RecipientList> {
    throw new NotImplementedException('listRecipients not yet implemented');
  }

  async getRecipientsByGroup(
    _request: AudienceProto.GetByGroupRequest,
  ): Promise<AudienceProto.RecipientList> {
    throw new NotImplementedException(
      'getRecipientsByGroup not yet implemented',
    );
  }

  async importRecipients(
    _request: AudienceProto.ImportRecipientsRequest,
  ): Promise<AudienceProto.ImportResult> {
    throw new NotImplementedException('importRecipients not yet implemented');
  }

  async markAsSent(
    _request: AudienceProto.MarkSentRequest,
  ): Promise<CommonProto.Empty> {
    throw new NotImplementedException('markAsSent not yet implemented');
  }

  async resetSendStatus(
    _request: AudienceProto.ResetStatusRequest,
  ): Promise<CommonProto.Empty> {
    throw new NotImplementedException('resetSendStatus not yet implemented');
  }
}
