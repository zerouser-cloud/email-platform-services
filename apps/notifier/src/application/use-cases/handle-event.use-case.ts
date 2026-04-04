import { Inject, Injectable } from '@nestjs/common';
import { HandleEventPort } from '../ports/inbound/handle-event.port';
import { NotificationSenderPort } from '../ports/outbound/notification-sender.port';
import { NOTIFICATION_SENDER_PORT } from '../../notifier.module';

@Injectable()
export class HandleEventUseCase implements HandleEventPort {
  constructor(
    @Inject(NOTIFICATION_SENDER_PORT)
    private readonly notificationSender: NotificationSenderPort,
  ) {}

  async execute(_eventType: string, _payload: Record<string, unknown>): Promise<void> {
    throw new Error('HandleEventUseCase not yet implemented');
  }
}
