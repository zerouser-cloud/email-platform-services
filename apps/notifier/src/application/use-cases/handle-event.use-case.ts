import { Inject, Injectable } from '@nestjs/common';
import { HandleEventPort } from '../ports/inbound/handle-event.port';
import { NotificationSenderPort } from '../ports/outbound/notification-sender.port';

@Injectable()
export class HandleEventUseCase implements HandleEventPort {
  constructor(
    @Inject('NotificationSenderPort')
    private readonly notificationSender: NotificationSenderPort,
  ) {}

  async execute(_eventType: string, _payload: Record<string, unknown>): Promise<void> {
    throw new Error('HandleEventUseCase not yet implemented');
  }
}
