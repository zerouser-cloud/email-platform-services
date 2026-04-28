import { Module } from '@nestjs/common';
import { CacheModule } from '@email-platform/foundation';
import { SERVICE } from '@email-platform/config';

/**
 * AppCacheModule (Phase 999.12 D-03) — thin app-level wrapper around the
 * foundation CacheModule. Fixes the namespace from the catalog identity
 * (SERVICE.sender.id) in a single place per service. Re-exports the
 * foundation CacheModule so consumers (HealthController via CACHE_HEALTH;
 * future business services via CACHE_SERVICE) receive both providers
 * transitively.
 *
 * `App` prefix disambiguates from foundation's `CacheModule` inside the
 * root module's imports list. Shape mirrors AppPersistenceModule
 * (Phase 999.11.2 D-06).
 *
 * No app-level Symbols (Anti-Pattern 5 — true-single-instance infra).
 */
@Module({
  imports: [CacheModule.forRootAsync({ namespace: SERVICE.sender.id })],
  exports: [CacheModule],
})
export class AppCacheModule {}
