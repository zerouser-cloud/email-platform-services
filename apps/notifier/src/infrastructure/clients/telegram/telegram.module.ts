import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { HTTP_CLIENT_DEFAULTS } from '@email-platform/foundation';
import { TelegramClient } from './telegram.client';
import {
  TELEGRAM_AUTH_HEADER_PREFIX,
  TELEGRAM_CLIENT,
  TELEGRAM_ENV,
  TELEGRAM_LOG_CONTEXT,
} from './telegram-client.constants';

const clientProvider: Provider = {
  provide: TELEGRAM_CLIENT,
  inject: [ConfigService, ClsService],
  useFactory: (config: ConfigService, cls: ClsService): TelegramClient =>
    new TelegramClient(
      cls,
      config.get<string>(TELEGRAM_ENV.BASE_URL)!,
      HTTP_CLIENT_DEFAULTS.TIMEOUT_MS,
      {
        consecutiveThreshold: HTTP_CLIENT_DEFAULTS.CB_CONSECUTIVE_THRESHOLD,
        halfOpenAfterMs: HTTP_CLIENT_DEFAULTS.CB_HALF_OPEN_AFTER_MS,
      },
      TELEGRAM_LOG_CONTEXT,
      `${TELEGRAM_AUTH_HEADER_PREFIX}${config.get<string>(TELEGRAM_ENV.BOT_TOKEN)!}`,
    ),
};

/**
 * TelegramClientModule — DynamicModule providing a single TelegramClient
 * instance via TELEGRAM_CLIENT token (D-20). Mirrors foundation's
 * per-service gRPC client module shape for parity.
 */
@Module({})
export class TelegramClientModule {
  static forRoot(): DynamicModule {
    return {
      module: TelegramClientModule,
      providers: [clientProvider],
      exports: [TELEGRAM_CLIENT],
    };
  }
}
