import type { ClientGrpc } from '@nestjs/microservices';
import { ParserProto, CommonProto } from '@email-platform/contracts';
import { SERVICE } from '@email-platform/config';
import type { GrpcCaller, CallOpts } from '@email-platform/foundation';

export class ParserClient {
  private readonly raw: ParserProto.ParserServiceClient;

  constructor(
    grpcClient: ClientGrpc,
    private readonly grpc: GrpcCaller,
  ) {
    this.raw = grpcClient.getService<ParserProto.ParserServiceClient>(
      SERVICE.parser.grpc.serviceName,
    );
  }

  healthCheck(req: CommonProto.Empty, opts?: CallOpts): Promise<CommonProto.HealthStatus> {
    return this.grpc.call('healthCheck', opts, (m) => this.raw.healthCheck(req, m));
  }
  createTask(
    req: ParserProto.CreateParserTaskRequest,
    opts?: CallOpts,
  ): Promise<ParserProto.ParserTask> {
    return this.grpc.call('createTask', opts, (m) => this.raw.createTask(req, m));
  }
  listTasks(
    req: ParserProto.ListParserTasksRequest,
    opts?: CallOpts,
  ): Promise<ParserProto.ParserTaskList> {
    return this.grpc.call('listTasks', opts, (m) => this.raw.listTasks(req, m));
  }
  getTask(req: ParserProto.ParserTaskIdRequest, opts?: CallOpts): Promise<ParserProto.ParserTask> {
    return this.grpc.call('getTask', opts, (m) => this.raw.getTask(req, m));
  }
  getSettings(req: CommonProto.Empty, opts?: CallOpts): Promise<ParserProto.ParserSettings> {
    return this.grpc.call('getSettings', opts, (m) => this.raw.getSettings(req, m));
  }
  updateSettings(
    req: ParserProto.UpdateParserSettingsRequest,
    opts?: CallOpts,
  ): Promise<ParserProto.ParserSettings> {
    return this.grpc.call('updateSettings', opts, (m) => this.raw.updateSettings(req, m));
  }
  runStorageSmoke(
    req: CommonProto.Empty,
    opts?: CallOpts,
  ): Promise<ParserProto.StorageSmokeResponse> {
    return this.grpc.call('runStorageSmoke', opts, (m) => this.raw.runStorageSmoke(req, m));
  }
  cleanupStorageSmoke(
    req: ParserProto.CleanupSmokeRequest,
    opts?: CallOpts,
  ): Promise<ParserProto.CleanupSmokeResponse> {
    return this.grpc.call('cleanupStorageSmoke', opts, (m) => this.raw.cleanupStorageSmoke(req, m));
  }
}
