import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { RabbitMqHealthIndicator } from '@email-platform/foundation';
import { HealthController } from './health.controller';
import { AppStorageModule } from '../../outbound/storage';

/**
 * HealthModule (Phase 999.11.2 D-08) — wires TerminusModule for Terminus primitives,
 * owns `RabbitMqHealthIndicator` as a class-based provider (not a DI token — NestJS
 * injects by class reference), and imports the notifier `AppStorageModule` composer
 * so the `PUBLIC_BUCKET_HEALTH` token propagates from `outbound/storage/reports/` up
 * to `HealthController`'s `@Inject(PUBLIC_BUCKET_HEALTH)` without relying on
 * root-level propagation.
 *
 * Notifier-specific: no database wiring because notifier has NO PostgreSQL
 * persistence (no aggregates, no pg schema — only RMQ inbound + Telegram outbound
 * + shared public bucket). Mirrors the auth HealthModule DATABASE_HEALTH wiring
 * pattern, substituting RABBITMQ_HEALTH + PUBLIC_BUCKET_HEALTH.
 */
@Module({
  imports: [TerminusModule, AppStorageModule],
  controllers: [HealthController],
  providers: [RabbitMqHealthIndicator],
  exports: [RabbitMqHealthIndicator],
})
export class HealthModule {}
