import { Inject, Injectable } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { ClsService } from 'nestjs-cls';
import { NotifierProto, CommonProto } from '@email-platform/contracts';
import { SERVICE } from '@email-platform/config';
import { AbstractGrpcClient } from '@email-platform/foundation';
import type { CallOpts } from '@email-platform/foundation';
import { NOTIFIER_CLIENT_GRPC } from './notifier-client.constants';

@Injectable()
export class NotifierClient extends AbstractGrpcClient<NotifierProto.NotifierServiceClient> {
  constructor(
    @Inject(NOTIFIER_CLIENT_GRPC) grpc: ClientGrpc,
    cls: ClsService,
    defaultDeadlineMs: number,
  ) {
    super(grpc, cls, SERVICE.notifier.grpc.serviceName, defaultDeadlineMs, NotifierClient.name);
  }

  healthCheck(request: CommonProto.Empty, opts?: CallOpts): Promise<CommonProto.HealthStatus> {
    return this.call('healthCheck', this.raw.healthCheck(request, this.buildMetadata(opts)));
  }
  runStorageSmoke(
    request: CommonProto.Empty,
    opts?: CallOpts,
  ): Promise<NotifierProto.StorageSmokeResponse> {
    return this.call(
      'runStorageSmoke',
      this.raw.runStorageSmoke(request, this.buildMetadata(opts)),
    );
  }
  cleanupStorageSmoke(
    request: NotifierProto.CleanupSmokeRequest,
    opts?: CallOpts,
  ): Promise<NotifierProto.CleanupSmokeResponse> {
    return this.call(
      'cleanupStorageSmoke',
      this.raw.cleanupStorageSmoke(request, this.buildMetadata(opts)),
    );
  }
}
