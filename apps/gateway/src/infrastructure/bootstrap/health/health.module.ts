import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { GrpcClientsModule } from '../../outbound/grpc-clients';
import { HealthController } from './health.controller';

/**
 * HealthModule wires TerminusModule + GrpcClientsModule (which provides the
 * 5 *_GRPC_HEALTH tokens via the 5 per-upstream client modules' exports).
 * Per Phase 999.11.2 D-08.
 *
 * Gateway has NO PostgreSQL persistence — foundation PersistenceModule is
 * deliberately NOT imported (verified gateway health.controller does NOT
 * inject DATABASE_HEALTH; only 5 *_GRPC_HEALTH tokens).
 */
@Module({
  imports: [TerminusModule, GrpcClientsModule],
  controllers: [HealthController],
})
export class HealthModule {}
