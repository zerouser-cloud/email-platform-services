import { Body, Controller, Inject, Post } from '@nestjs/common';
import { TelegramTypes } from '@email-platform/contracts';
import { TelegramClient } from '../infrastructure/clients/telegram/telegram.client';
import { TELEGRAM_CLIENT } from '../infrastructure/clients/telegram/telegram-client.constants';

const TELEGRAM_SMOKE = {
  ROUTE: 'test/telegram',
  SEND: 'send',
} as const;

@Controller(TELEGRAM_SMOKE.ROUTE)
export class TelegramSmokeController {
  constructor(@Inject(TELEGRAM_CLIENT) private readonly client: TelegramClient) {}

  @Post(TELEGRAM_SMOKE.SEND)
  async send(
    @Body() body: TelegramTypes.SendMessageRequest,
  ): Promise<TelegramTypes.SendMessageResponse> {
    return this.client.sendMessage(body);
  }
}
