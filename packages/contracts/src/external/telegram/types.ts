// Telegram Bot API — skeleton types (Phase 24 D-18).
// Vendor reference: https://core.telegram.org/bots/api#sendmessage
// Full surface intentionally deferred to business-logic phase.
export interface SendMessageRequest {
  readonly chat_id: number | string;
  readonly text: string;
  readonly parse_mode?: 'MarkdownV2' | 'HTML';
  readonly disable_notification?: boolean;
}

export interface TelegramMessage {
  readonly message_id: number;
  readonly date: number;
  readonly text?: string;
}

export interface SendMessageResponse {
  readonly ok: boolean;
  readonly result: TelegramMessage;
}
