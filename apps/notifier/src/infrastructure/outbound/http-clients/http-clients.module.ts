import { Module } from '@nestjs/common';
import { TelegramClientModule } from './telegram';

/**
 * HttpClientsModule (Phase 999.11.2 D-06) — app-level composer for outbound
 * HTTP vendor clients. Single-sub today (telegram); the composer layer stays
 * per D-06 verbatim so future vendors are added by editing this imports/exports
 * array without restructuring the composition root.
 *
 * OQ-5: `TelegramNotificationAdapter` is NOT exported here. The adapter class
 * is imported directly by root `notifier.module.ts` for the
 * `NOTIFICATION_SENDER_PORT` binding — keeping the outbound-port binding at the
 * composition root per RESEARCH §OQ-5 recommendation.
 */
@Module({
  imports: [TelegramClientModule.forRoot()],
  exports: [TelegramClientModule],
})
export class HttpClientsModule {}
