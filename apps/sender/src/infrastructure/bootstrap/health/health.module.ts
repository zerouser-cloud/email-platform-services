import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { PersistenceModule } from '@email-platform/foundation';
import { HealthController } from './health.controller';
import { AppCacheModule } from '../../outbound/cache';

/**
 * HealthModule (Phase 999.11.2 D-08; AppCacheModule wiring per Phase 999.12 D-05) —
 * wires TerminusModule + foundation PersistenceModule (exports PERSISTENCE_HEALTH)
 * + AppCacheModule (re-exports foundation CacheModule, namespace from catalog)
 * so HealthController's dual `@Inject(PERSISTENCE_HEALTH)` AND `@Inject(CACHE_HEALTH)`
 * resolves without relying on root-level propagation.
 */
@Module({
  imports: [TerminusModule, PersistenceModule.forRootAsync(), AppCacheModule],
  controllers: [HealthController],
})
export class HealthModule {}
