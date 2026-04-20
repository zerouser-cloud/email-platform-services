import { Module, type DynamicModule } from '@nestjs/common';
import { httpClientProvider } from '@email-platform/foundation';
import { TelegramClient } from './telegram.client';
import { TELEGRAM_CLIENT, TELEGRAM_ENV, TELEGRAM_LOG_CONTEXT } from './telegram-client.constants';
import { NOTIFIER_CONFIG } from '../../../notifier.constants';
import type { NotifierEnv } from '../../config';

/**
 * TelegramClientModule — DynamicModule providing a single TelegramClient
 * instance via TELEGRAM_CLIENT token (D-20). Mirrors foundation's
 * per-service gRPC client module shape for parity.
 *
 * Phase 999.11.1 Plan 06: consumes narrow `NotifierEnv` slice via
 * `envToken: NOTIFIER_CONFIG` (D-10 cascade).
 */
@Module({})
export class TelegramClientModule {
  static forRoot(): DynamicModule {
    return {
      module: TelegramClientModule,
      providers: [
        httpClientProvider<TelegramClient, NotifierEnv>(
          {
            token: TELEGRAM_CLIENT,
            logContext: TELEGRAM_LOG_CONTEXT,
            envToken: NOTIFIER_CONFIG,
            baseUrlEnvKey: TELEGRAM_ENV.BASE_URL,
          },
          (deps) => new TelegramClient(deps, deps.env[TELEGRAM_ENV.BOT_TOKEN] as string),
        ),
      ],
      exports: [TELEGRAM_CLIENT],
    };
  }
}
