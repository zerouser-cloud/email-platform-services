import { Module } from '@nestjs/common';
import { AudienceController } from './audience.controller';

/**
 * Inbound gRPC composer (Phase 999.11.2 D-03, D-06).
 *
 * Owns the gRPC controller. Port → service bindings (LIST_GROUPS_PORT → ListGroupsService, etc.)
 * remain in the root composition root (AudienceModule) because services are registered
 * globally per-service and injected into the controller via Symbol tokens.
 */
@Module({ controllers: [AudienceController] })
export class GrpcModule {}
