import { Injectable } from '@nestjs/common';
import { AbstractHttpClient, type HttpClientDeps } from '@email-platform/foundation';
import { TelegramTypes } from '@email-platform/contracts';
import { TELEGRAM_PATH } from './telegram-client.constants';

/**
 * TelegramClient — skeleton HTTP adapter for Telegram Bot API (D-18).
 * Extends the foundation AbstractHttpClient; per-adapter CB instance is
 * configured in TelegramClientModule.forRoot() (D-08 isolation).
 *
 * Telegram Bot API auth is path-based: `/bot<TOKEN>/<method>`. No Authorization
 * header — `buildAuthHeaders` stays at its base default (`{}`). botToken is held
 * on this adapter and injected into the request path.
 *
 * KNOWN ISSUE: Telegram path-auth embeds the bot token in the URL, so the
 * `http.client.call` log field `url` leaks the token to any log aggregator.
 * This adapter is a skeleton (Phase 24 D-18). A follow-up phase (ROADMAP 999.8)
 * migrates this to the grammY/telegraf SDK and logs at operation level
 * (`operation: 'sendMessage'`) so no URL ever reaches the logger.
 *
 * D-10: sendMessage is POST without `{ idempotent: true }` — Telegram offers no
 * idempotency key, so retrying after a mid-accept 5xx risks duplicate deliveries.
 * Single-shot by default; callers may opt in to retry later when supported.
 */
@Injectable()
export class TelegramClient extends AbstractHttpClient {
  constructor(
    deps: HttpClientDeps,
    private readonly botToken: string,
  ) {
    super(deps);
  }

  sendMessage(req: TelegramTypes.SendMessageRequest): Promise<TelegramTypes.SendMessageResponse> {
    return this.post<TelegramTypes.SendMessageResponse>(
      `/bot${this.botToken}${TELEGRAM_PATH.SEND_MESSAGE}`,
      req,
    );
  }
}
