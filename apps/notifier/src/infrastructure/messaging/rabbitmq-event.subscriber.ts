import { Inject, Injectable, NotImplementedException } from '@nestjs/common';
import { HandleEventPort } from '../../application/ports/inbound/handle-event.port';

@Injectable()
export class RabbitMQEventSubscriber {
  constructor(
    @Inject('HandleEventPort')
    private readonly handleEventPort: HandleEventPort,
  ) {}

  // TODO: Add @EventPattern() decorators when RabbitMQ transport is configured
  async onEvent(eventType: string, payload: Record<string, unknown>): Promise<void> {
    throw new NotImplementedException('RabbitMQ event handling not yet implemented');
  }
}
