import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';

/**
 * Inbound gRPC composer (Phase 999.11.2 D-03, D-06).
 *
 * Owns the gRPC controller. Port → service bindings (LOGIN_PORT → LoginService, etc.)
 * remain in the root composition root (AuthModule) because services are registered
 * globally per-service and injected into the controller via Symbol tokens.
 */
@Module({ controllers: [AuthController] })
export class GrpcModule {}
