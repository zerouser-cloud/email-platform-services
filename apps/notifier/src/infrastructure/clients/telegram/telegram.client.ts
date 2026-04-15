import { Injectable } from '@nestjs/common';
import type { ClsService } from 'nestjs-cls';
import { AbstractHttpClient, type CbOptions } from '@email-platform/foundation';
import { TelegramTypes } from '@email-platform/contracts';
import { TELEGRAM_PATH } from './telegram-client.constants';

/**
 * TelegramClient — skeleton HTTP adapter for Telegram Bot API (D-18).
 * Extends the foundation AbstractHttpClient; per-adapter CB instance is
 * configured in TelegramClientModule.forRoot() (D-08 isolation).
 *
 * Telegram Bot API auth is path-based: `/bot<TOKEN>/<method>`. No Authorization
 * header. botToken is held on this adapter, not in baseUrl, so the secret lives
 * in exactly one place and baseUrl stays a true base URL.
 *
 * D-10: sendMessage is POST without `{ idempotent: true }` — Telegram offers no
 * idempotency key, so retrying after a mid-accept 5xx risks duplicate deliveries.
 * Single-shot by default; callers may opt in to retry later when supported.
 */
@Injectable()
export class TelegramClient extends AbstractHttpClient {
  constructor(
    cls: ClsService,
    baseUrl: string,
    defaultTimeoutMs: number,
    cbOptions: CbOptions,
    logContext: string,
    private readonly botToken: string,
  ) {
    super(cls, baseUrl, defaultTimeoutMs, cbOptions, logContext);
  }

  sendMessage(req: TelegramTypes.SendMessageRequest): Promise<TelegramTypes.SendMessageResponse> {
    return this.post<TelegramTypes.SendMessageResponse>(
      `/bot${this.botToken}${TELEGRAM_PATH.SEND_MESSAGE}`,
      req,
    );
  }
}
