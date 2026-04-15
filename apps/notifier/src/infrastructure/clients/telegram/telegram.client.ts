import { Injectable } from '@nestjs/common';
import { AbstractHttpClient } from '@email-platform/foundation';
import { TelegramTypes } from '@email-platform/contracts';
import { TELEGRAM_PATH } from './telegram-client.constants';

/**
 * TelegramClient — skeleton HTTP adapter for Telegram Bot API (D-18).
 * Extends the foundation AbstractHttpClient; per-adapter CB instance is
 * configured in TelegramClientModule.forRoot() (D-08 isolation).
 *
 * D-10: sendMessage is POST without `{ idempotent: true }` — Telegram offers no
 * idempotency key, so retrying after a mid-accept 5xx risks duplicate deliveries.
 * Single-shot by default; callers may opt in to retry later when supported.
 */
@Injectable()
export class TelegramClient extends AbstractHttpClient {
  sendMessage(req: TelegramTypes.SendMessageRequest): Promise<TelegramTypes.SendMessageResponse> {
    return this.post<TelegramTypes.SendMessageResponse>(TELEGRAM_PATH.SEND_MESSAGE, req);
  }
}
