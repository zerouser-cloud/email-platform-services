import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { GrpcClientsModule } from '../../outbound/grpc-clients';
import { AppCacheModule } from '../../outbound/cache';
import { HealthController } from './health.controller';

/**
 * HealthModule wires TerminusModule + GrpcClientsModule (which provides the
 * 5 *_GRPC_HEALTH tokens via the 5 per-upstream client modules' exports) +
 * AppCacheModule (re-exports foundation CacheModule, providing CACHE_HEALTH
 * for the readiness probe — cross-ring D-05 per Phase 999.12). Per Phase
 * 999.11.2 D-08 + Phase 999.12 D-05 (AppCacheModule wiring).
 *
 * Gateway has NO PostgreSQL persistence — foundation PersistenceModule is
 * deliberately NOT imported (verified gateway health.controller does NOT
 * inject DATABASE_HEALTH; only 5 *_GRPC_HEALTH tokens + CACHE_HEALTH).
 */
@Module({
  imports: [TerminusModule, GrpcClientsModule, AppCacheModule],
  controllers: [HealthController],
})
export class HealthModule {}
