import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { PersistenceModule, CacheModule } from '@email-platform/foundation';
import { HealthController } from './health.controller';

/**
 * HealthModule (Phase 999.11.2 D-08) — wires TerminusModule + foundation
 * PersistenceModule (exports DATABASE_HEALTH) + foundation CacheModule
 * (exports REDIS_HEALTH) so HealthController's dual `@Inject(DATABASE_HEALTH)`
 * AND `@Inject(REDIS_HEALTH)` resolves without relying on root-level
 * propagation. Foundation's modules are NOT `@Global()`.
 *
 * CacheModule is instantiated with `namespace: 'sender'` so Redis health
 * indicator logs / keys are namespaced per service.
 */
@Module({
  imports: [
    TerminusModule,
    PersistenceModule.forRootAsync(),
    CacheModule.forRootAsync({ namespace: 'sender' }),
  ],
  controllers: [HealthController],
})
export class HealthModule {}
