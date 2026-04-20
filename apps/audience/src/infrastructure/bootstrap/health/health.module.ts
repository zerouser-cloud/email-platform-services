import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { PersistenceModule } from '@email-platform/foundation';
import { HealthController } from './health.controller';

/**
 * HealthModule wires Terminus + foundation's PersistenceModule (which exports
 * DATABASE_HEALTH) so HealthController's @Inject(DATABASE_HEALTH) resolves.
 * Per Phase 999.11.2 D-08. Foundation's PersistenceModule is NOT @Global()
 * (verified packages/foundation/src/external/persistence/persistence.module.ts),
 * so it must be explicitly imported here.
 */
@Module({
  imports: [TerminusModule, PersistenceModule.forRootAsync()],
  controllers: [HealthController],
})
export class HealthModule {}
