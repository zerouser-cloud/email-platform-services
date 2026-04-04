import { Injectable, NotImplementedException } from '@nestjs/common';
import { Notification } from '../../domain/entities/notification.entity';
import { NotificationSenderPort } from '../../application/ports/outbound/notification-sender.port';

@Injectable()
export class TelegramNotificationSender implements NotificationSenderPort {
  async send(_notification: Notification): Promise<void> {
    throw new NotImplementedException('TelegramNotificationSender not yet implemented');
  }
}
