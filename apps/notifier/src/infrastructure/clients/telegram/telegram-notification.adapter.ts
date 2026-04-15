import { Inject, Injectable } from '@nestjs/common';
import { TelegramTypes } from '@email-platform/contracts';
import { NotificationSenderPort } from '../../../application/ports/outbound/notification-sender.port';
import { Notification } from '../../../domain/entities/notification.entity';
import { TelegramClient } from './telegram.client';
import { TELEGRAM_CLIENT } from './telegram-client.constants';

/**
 * TelegramNotificationAdapter — implements the outbound NotificationSenderPort
 * by delegating to TelegramClient.sendMessage.
 *
 * D-18 skeleton scope: the domain Notification entity currently carries
 * (id, eventType, payload, sentAt) with no explicit recipient/chat_id field.
 * This adapter treats `notification.payload` as a JSON envelope of the form
 * `{ "chat_id": "...", "text": "..." }`. Full domain routing (recipient
 * resolution, formatting, template expansion) is deferred to the business-
 * logic phase — the skeleton only proves the wiring from port → HTTP client
 * works end-to-end.
 */
@Injectable()
export class TelegramNotificationAdapter implements NotificationSenderPort {
  constructor(@Inject(TELEGRAM_CLIENT) private readonly telegram: TelegramClient) {}

  async send(notification: Notification): Promise<void> {
    const envelope = JSON.parse(notification.payload) as {
      chat_id: number | string;
      text: string;
    };
    const req: TelegramTypes.SendMessageRequest = {
      chat_id: envelope.chat_id,
      text: envelope.text,
    };
    await this.telegram.sendMessage(req);
  }
}
