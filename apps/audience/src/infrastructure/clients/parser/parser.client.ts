import type { ClientGrpc } from '@nestjs/microservices';
import { ClsService } from 'nestjs-cls';
import { ParserProto, CommonProto } from '@email-platform/contracts';
import { SERVICE } from '@email-platform/config';
import { AbstractGrpcClient } from '@email-platform/foundation';
import type { CallOpts } from '@email-platform/foundation';

export class ParserClient extends AbstractGrpcClient<ParserProto.ParserServiceClient> {
  constructor(grpc: ClientGrpc, cls: ClsService, defaultDeadlineMs: number) {
    super(grpc, cls, SERVICE.parser.grpc.serviceName, defaultDeadlineMs, ParserClient.name);
  }

  healthCheck(request: CommonProto.Empty, opts?: CallOpts): Promise<CommonProto.HealthStatus> {
    return this.call('healthCheck', this.raw.healthCheck(request, this.buildMetadata(opts)));
  }
  createTask(
    request: ParserProto.CreateParserTaskRequest,
    opts?: CallOpts,
  ): Promise<ParserProto.ParserTask> {
    return this.call('createTask', this.raw.createTask(request, this.buildMetadata(opts)));
  }
  listTasks(
    request: ParserProto.ListParserTasksRequest,
    opts?: CallOpts,
  ): Promise<ParserProto.ParserTaskList> {
    return this.call('listTasks', this.raw.listTasks(request, this.buildMetadata(opts)));
  }
  getTask(
    request: ParserProto.ParserTaskIdRequest,
    opts?: CallOpts,
  ): Promise<ParserProto.ParserTask> {
    return this.call('getTask', this.raw.getTask(request, this.buildMetadata(opts)));
  }
  getSettings(request: CommonProto.Empty, opts?: CallOpts): Promise<ParserProto.ParserSettings> {
    return this.call('getSettings', this.raw.getSettings(request, this.buildMetadata(opts)));
  }
  updateSettings(
    request: ParserProto.UpdateParserSettingsRequest,
    opts?: CallOpts,
  ): Promise<ParserProto.ParserSettings> {
    return this.call('updateSettings', this.raw.updateSettings(request, this.buildMetadata(opts)));
  }
  runStorageSmoke(
    request: CommonProto.Empty,
    opts?: CallOpts,
  ): Promise<ParserProto.StorageSmokeResponse> {
    return this.call(
      'runStorageSmoke',
      this.raw.runStorageSmoke(request, this.buildMetadata(opts)),
    );
  }
  cleanupStorageSmoke(
    request: ParserProto.CleanupSmokeRequest,
    opts?: CallOpts,
  ): Promise<ParserProto.CleanupSmokeResponse> {
    return this.call(
      'cleanupStorageSmoke',
      this.raw.cleanupStorageSmoke(request, this.buildMetadata(opts)),
    );
  }
}
