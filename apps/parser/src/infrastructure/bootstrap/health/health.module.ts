import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { PersistenceModule } from '@email-platform/foundation';
import { HealthController } from './health.controller';
import { AppStorageModule } from '../../outbound/storage';

/**
 * HealthModule (Phase 999.11.2 D-08) — wires TerminusModule + foundation
 * PersistenceModule (exports DATABASE_HEALTH) + AppStorageModule (exports
 * PARSER_STORAGE_HEALTH via the private bucket sub-module) so HealthController's
 * dual `@Inject(DATABASE_HEALTH)` AND `@Inject(PARSER_STORAGE_HEALTH)` resolves
 * without relying on root-level propagation. Foundation's PersistenceModule is
 * NOT `@Global()`.
 *
 * AppStorageModule is the parser storage composer (outbound/storage/) that
 * aggregates BucketModule (private parser bucket, provides PARSER_STORAGE_HEALTH)
 * and ReportsModule (shared reports namespace). Per 999.11.2 DC-06 legitimate
 * composition preserved from 999.11.1.
 */
@Module({
  imports: [TerminusModule, PersistenceModule.forRootAsync(), AppStorageModule],
  controllers: [HealthController],
})
export class HealthModule {}
