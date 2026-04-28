import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { RabbitMqHealthIndicator } from '@email-platform/foundation';
import { HealthController } from './health.controller';
import { AppStorageModule } from '../../outbound/storage';
import { AppCacheModule } from '../../outbound/cache';

/**
 * HealthModule (Phase 999.11.2 D-08; AppCacheModule wiring per Phase 999.12 D-05) —
 * wires TerminusModule for Terminus primitives, owns `RabbitMqHealthIndicator` as a
 * class-based provider (not a DI token — NestJS injects by class reference; the
 * pre-existing class-based asymmetry is preserved per Phase 999.12 RESEARCH §S-5
 * and will be promoted to a Symbol in a future phase), and imports the notifier
 * `AppStorageModule` composer so the `PUBLIC_BUCKET_HEALTH` token propagates from
 * `outbound/storage/reports/` up to `HealthController`'s `@Inject(PUBLIC_BUCKET_HEALTH)`
 * without relying on root-level propagation. `AppCacheModule` re-exports the
 * foundation `CacheModule` so the `CACHE_HEALTH` token resolves at the controller
 * the same way (foundation modules are NOT @Global()).
 *
 * Notifier-specific: no database wiring because notifier has NO PostgreSQL
 * persistence (no aggregates, no pg schema — only RMQ inbound + Telegram outbound
 * + shared public bucket + Redis cache cаркас). Mirrors the auth HealthModule
 * PERSISTENCE_HEALTH wiring pattern, substituting RABBITMQ_HEALTH + PUBLIC_BUCKET_HEALTH
 * + CACHE_HEALTH.
 */
@Module({
  imports: [TerminusModule, AppStorageModule, AppCacheModule],
  controllers: [HealthController],
  providers: [RabbitMqHealthIndicator],
  exports: [RabbitMqHealthIndicator],
})
export class HealthModule {}
