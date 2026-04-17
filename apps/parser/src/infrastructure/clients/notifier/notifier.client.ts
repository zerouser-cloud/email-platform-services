import type { ClientGrpc } from '@nestjs/microservices';
import { NotifierProto, CommonProto } from '@email-platform/contracts';
import { SERVICE } from '@email-platform/config';
import type { GrpcCaller, CallOpts } from '@email-platform/foundation';

export class NotifierClient {
  private readonly raw: NotifierProto.NotifierServiceClient;

  constructor(
    grpcClient: ClientGrpc,
    private readonly grpc: GrpcCaller,
  ) {
    this.raw = grpcClient.getService<NotifierProto.NotifierServiceClient>(
      SERVICE.notifier.grpc.serviceName,
    );
  }

  healthCheck(req: CommonProto.Empty, opts?: CallOpts): Promise<CommonProto.HealthStatus> {
    return this.grpc.call('healthCheck', opts, (m) => this.raw.healthCheck(req, m));
  }
  runStorageSmoke(
    req: CommonProto.Empty,
    opts?: CallOpts,
  ): Promise<NotifierProto.StorageSmokeResponse> {
    return this.grpc.call('runStorageSmoke', opts, (m) => this.raw.runStorageSmoke(req, m));
  }
  cleanupStorageSmoke(
    req: NotifierProto.CleanupSmokeRequest,
    opts?: CallOpts,
  ): Promise<NotifierProto.CleanupSmokeResponse> {
    return this.grpc.call('cleanupStorageSmoke', opts, (m) => this.raw.cleanupStorageSmoke(req, m));
  }
}
