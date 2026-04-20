import { Module } from '@nestjs/common';
import { EventConsumer } from './event.consumer';
import { HandleEventUseCase } from '../../../application/use-cases/handle-event.use-case';
import { HttpClientsModule } from '../../outbound/http-clients';
import { TelegramNotificationAdapter } from '../../outbound/http-clients/telegram';
import { HANDLE_EVENT_PORT, NOTIFICATION_SENDER_PORT } from '../../../notifier.constants';

/**
 * RmqModule (Phase 999.11.2 D-05, D-06) — inbound RMQ composer. Declares the
 * `EventConsumer` adapter and owns the port bindings its consumer-side dependency
 * chain consumes (Phase 999.11.2 Plan 10 DI-regression fix, Option A):
 *
 *   - `HANDLE_EVENT_PORT` → `HandleEventUseCase` (inbound — consumer-cohesive)
 *   - `NOTIFICATION_SENDER_PORT` → `TelegramNotificationAdapter` (outbound —
 *     consumed only by `HandleEventUseCase`, so the RMQ inbound boundary is the
 *     single runtime driver; when future application services consume the same
 *     port outside the RMQ boundary, this binding relocates to an app-level
 *     composer).
 *
 * Imports `HttpClientsModule` to expose `TELEGRAM_CLIENT` (used by
 * `TelegramNotificationAdapter`) into this module's DI scope.
 */
@Module({
  imports: [HttpClientsModule],
  providers: [
    EventConsumer,
    { provide: HANDLE_EVENT_PORT, useClass: HandleEventUseCase },
    { provide: NOTIFICATION_SENDER_PORT, useClass: TelegramNotificationAdapter },
  ],
  exports: [EventConsumer, HANDLE_EVENT_PORT],
})
export class RmqModule {}
