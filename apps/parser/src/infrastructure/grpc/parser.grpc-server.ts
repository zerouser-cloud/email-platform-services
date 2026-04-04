import { Controller, Inject, NotImplementedException } from '@nestjs/common';
import { ParserProto, CommonProto } from '@email-platform/contracts';
import { StartParsingPort } from '../../application/ports/inbound/start-parsing.port';

@Controller()
@ParserProto.ParserServiceControllerMethods()
export class ParserGrpcServer implements ParserProto.ParserServiceController {
  constructor(
    @Inject('StartParsingPort')
    private readonly startParsingPort: StartParsingPort,
  ) {}

  async healthCheck(_request: CommonProto.Empty): Promise<CommonProto.HealthStatus> {
    throw new NotImplementedException('healthCheck not yet implemented');
  }

  async createTask(_request: ParserProto.CreateParserTaskRequest): Promise<ParserProto.ParserTask> {
    throw new NotImplementedException('createTask not yet implemented');
  }

  async listTasks(
    _request: ParserProto.ListParserTasksRequest,
  ): Promise<ParserProto.ParserTaskList> {
    throw new NotImplementedException('listTasks not yet implemented');
  }

  async getTask(_request: ParserProto.ParserTaskIdRequest): Promise<ParserProto.ParserTask> {
    throw new NotImplementedException('getTask not yet implemented');
  }

  async getSettings(_request: CommonProto.Empty): Promise<ParserProto.ParserSettings> {
    throw new NotImplementedException('getSettings not yet implemented');
  }

  async updateSettings(
    _request: ParserProto.UpdateParserSettingsRequest,
  ): Promise<ParserProto.ParserSettings> {
    throw new NotImplementedException('updateSettings not yet implemented');
  }
}
