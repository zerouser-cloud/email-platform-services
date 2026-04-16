import { Module, type DynamicModule } from '@nestjs/common';
import { httpClientProvider } from '@email-platform/foundation';
import { TelegramClient } from './telegram.client';
import { TELEGRAM_CLIENT, TELEGRAM_ENV, TELEGRAM_LOG_CONTEXT } from './telegram-client.constants';

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
      providers: [
        httpClientProvider(
          {
            token: TELEGRAM_CLIENT,
            logContext: TELEGRAM_LOG_CONTEXT,
            baseUrlEnvKey: TELEGRAM_ENV.BASE_URL,
          },
          (deps) =>
            new TelegramClient(deps, deps.config.getOrThrow<string>(TELEGRAM_ENV.BOT_TOKEN)),
        ),
      ],
      exports: [TELEGRAM_CLIENT],
    };
  }
}
