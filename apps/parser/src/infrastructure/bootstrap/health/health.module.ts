import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { PersistenceModule } from '@email-platform/foundation';
import { HealthController } from './health.controller';
import { AppStorageModule } from '../../outbound/storage';
import { AppCacheModule } from '../../outbound/cache';

/**
 * HealthModule (Phase 999.11.2 D-08; AppCacheModule wiring per Phase 999.12 D-05) —
 * wires TerminusModule + foundation PersistenceModule (exports DATABASE_HEALTH)
 * + AppStorageModule (exports PARSER_STORAGE_HEALTH via the private bucket
 * sub-module) + AppCacheModule (re-exports foundation CacheModule, namespace
 * from catalog — exports REDIS_HEALTH) so HealthController's three injects
 * (`@Inject(DATABASE_HEALTH)`, `@Inject(PARSER_STORAGE_HEALTH)`, and
 * `@Inject(REDIS_HEALTH)`) resolve without relying on root-level propagation.
 * Foundation's PersistenceModule is NOT `@Global()`.
 *
 * AppStorageModule is the parser storage composer (outbound/storage/) that
 * aggregates BucketModule (private parser bucket, provides PARSER_STORAGE_HEALTH)
 * and ReportsModule (shared reports namespace). Per 999.11.2 DC-06 legitimate
 * composition preserved from 999.11.1.
 */
@Module({
  imports: [TerminusModule, PersistenceModule.forRootAsync(), AppStorageModule, AppCacheModule],
  controllers: [HealthController],
})
export class HealthModule {}
