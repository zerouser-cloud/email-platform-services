import { Module } from '@nestjs/common';
import { SenderController } from './sender.controller';

/**
 * GrpcModule (Phase 999.11.2 D-03) — owns the gRPC controller for the sender
 * bounded context. Root `sender.module.ts` imports this module instead of
 * registering `SenderController` directly in `controllers[]`.
 *
 * Inbound port → service bindings (LIST_CAMPAIGNS_PORT → ListCampaignsService,
 * etc.) remain in root `SenderModule` providers[] — services are registered
 * at the composition root and injected into the controller via Symbol tokens.
 */
@Module({
  controllers: [SenderController],
})
export class GrpcModule {}
