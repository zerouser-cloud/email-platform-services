import { Inject, Injectable, NotImplementedException } from '@nestjs/common';
import { HandleEventPort } from '../../../application/ports/inbound/handle-event.port';
import { HANDLE_EVENT_PORT } from '../../../notifier.constants';

/**
 * EventConsumer (Phase 999.11.2 D-05) — canonical RMQ inbound adapter.
 * Translates external RabbitMQ events into the application's inbound
 * `HandleEventPort.handle(...)` call. File idiom is `{event-type}.consumer.ts`
 * (generic `event` reflects the single-handler scope today; future
 * per-event-type consumers will live alongside).
 */
@Injectable()
export class EventConsumer {
  constructor(
    @Inject(HANDLE_EVENT_PORT)
    private readonly handleEventPort: HandleEventPort,
  ) {}

  // TODO: Add @EventPattern() decorators when RabbitMQ transport is configured
  async onEvent(eventType: string, payload: Record<string, unknown>): Promise<void> {
    throw new NotImplementedException('RabbitMQ event handling not yet implemented');
  }
}
