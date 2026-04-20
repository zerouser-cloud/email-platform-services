import { Module } from '@nestjs/common';
import { EventConsumer } from './event.consumer';
import { HandleEventUseCase } from '../../../application/use-cases/handle-event.use-case';
import { HANDLE_EVENT_PORT } from '../../../notifier.constants';

/**
 * RmqModule (Phase 999.11.2 D-05, D-06) — inbound RMQ composer. Declares the
 * `EventConsumer` adapter and binds the inbound `HANDLE_EVENT_PORT` token to
 * the `HandleEventUseCase` implementation. Moving the HANDLE_EVENT_PORT binding
 * into the inbound boundary keeps it cohesive with the consumer that triggers
 * it. The outbound `NOTIFICATION_SENDER_PORT` binding stays at the composition
 * root per OQ-5 (TelegramNotificationAdapter is used by application services
 * across boundaries, not just from RMQ).
 */
@Module({
  providers: [EventConsumer, { provide: HANDLE_EVENT_PORT, useClass: HandleEventUseCase }],
  exports: [EventConsumer, HANDLE_EVENT_PORT],
})
export class RmqModule {}
