import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { MessagingModule } from '@email-platform/foundation';
import { HealthController } from './health.controller';
import { AppStorageModule } from '../../outbound/storage';
import { AppCacheModule } from '../../outbound/cache';

/**
 * HealthModule (Phase 999.12.1 D-08 — MessagingModule import; Phase 999.12 D-05
 * AppCacheModule wiring; Phase 999.11.2 D-08 root structure) — wires
 * TerminusModule, MessagingModule.forRootAsync() (Symbol-DI for MESSAGING_HEALTH —
 * promoted from class-based DI per Phase 999.12.1 D-08 layer-name axis lock-in),
 * AppStorageModule (PUBLIC_STORAGE_HEALTH propagation from outbound/storage/reports/),
 * and AppCacheModule (CACHE_HEALTH propagation from outbound/cache/) so
 * HealthController's three injects (@Inject(MESSAGING_HEALTH),
 * @Inject(PUBLIC_STORAGE_HEALTH), @Inject(CACHE_HEALTH)) all resolve.
 *
 * Notifier-specific: no database wiring (notifier has NO PostgreSQL persistence —
 * no aggregates, no pg schema). Mirrors auth HealthModule PERSISTENCE_HEALTH
 * wiring pattern, substituting MESSAGING_HEALTH + PUBLIC_STORAGE_HEALTH + CACHE_HEALTH.
 */
@Module({
  imports: [TerminusModule, MessagingModule.forRootAsync(), AppStorageModule, AppCacheModule],
  controllers: [HealthController],
})
export class HealthModule {}
