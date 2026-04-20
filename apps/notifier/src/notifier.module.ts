import { Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { notifierConfigProvider, type NotifierEnv } from './infrastructure/config';
import {
  LoggingModule,
  RabbitMqHealthIndicator,
  LOGGING_CONFIG_PORT,
  STORAGE_CORE_CONFIG_PORT,
  PUBLIC_STORAGE_CONFIG_PORT,
  type LoggingConfig,
  type StorageCoreConfig,
  type PublicStorageConfig,
} from '@email-platform/foundation';
import { HandleEventUseCase } from './application/use-cases/handle-event.use-case';
import {
  TelegramClientModule,
  TelegramNotificationAdapter,
} from './infrastructure/clients/telegram';
import { RabbitMQEventSubscriber } from './infrastructure/messaging/rabbitmq-event.subscriber';
import { StorageModule } from './infrastructure/storage';
import { HealthController } from './infrastructure/controllers/rest/health.controller';
import { HANDLE_EVENT_PORT, NOTIFICATION_SENDER_PORT, NOTIFIER_CONFIG } from './notifier.constants';

@Module({
  imports: [
    TerminusModule,
    StorageModule,
    LoggingModule.forHttpAsync('notifier'),
    TelegramClientModule.forRoot(),
  ],
  controllers: [HealthController],
  providers: [
    notifierConfigProvider,

    // Canonical Config Access Contract (Phase 999.11.1 D-10) — narrow config slices.
    {
      provide: LOGGING_CONFIG_PORT,
      useFactory: (c: NotifierEnv): LoggingConfig => ({
        LOG_LEVEL: c.LOG_LEVEL,
        LOG_FORMAT: c.LOG_FORMAT,
      }),
      inject: [NOTIFIER_CONFIG],
    },
    {
      provide: STORAGE_CORE_CONFIG_PORT,
      useFactory: (c: NotifierEnv): StorageCoreConfig => ({
        STORAGE_PROTOCOL: c.STORAGE_PROTOCOL,
        STORAGE_ENDPOINT: c.STORAGE_ENDPOINT,
        STORAGE_PORT: c.STORAGE_PORT,
        STORAGE_REGION: c.STORAGE_REGION,
        STORAGE_ACCESS_KEY: c.STORAGE_ACCESS_KEY,
        STORAGE_SECRET_KEY: c.STORAGE_SECRET_KEY,
      }),
      inject: [NOTIFIER_CONFIG],
    },
    {
      provide: PUBLIC_STORAGE_CONFIG_PORT,
      useFactory: (c: NotifierEnv): PublicStorageConfig => ({
        STORAGE_PUBLIC_URL: c.STORAGE_PUBLIC_URL,
        STORAGE_MAX_UPLOAD_BYTES: c.STORAGE_MAX_UPLOAD_BYTES,
      }),
      inject: [NOTIFIER_CONFIG],
    },

    { provide: NOTIFICATION_SENDER_PORT, useClass: TelegramNotificationAdapter },
    { provide: HANDLE_EVENT_PORT, useClass: HandleEventUseCase },
    RabbitMQEventSubscriber,
    RabbitMqHealthIndicator,
  ],
})
export class NotifierModule implements OnModuleDestroy {
  private readonly logger = new Logger(NotifierModule.name);

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down notifier service...');
    // TODO: close RabbitMQ subscriber connection
  }
}
