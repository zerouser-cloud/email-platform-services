import { Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { AppConfigModule } from '@email-platform/config';
import { NotifierEnvSchema, notifierConfigProvider } from './infrastructure/config';
import { LoggingModule, RabbitMqHealthIndicator } from '@email-platform/foundation';
import { HandleEventUseCase } from './application/use-cases/handle-event.use-case';
import {
  TelegramClientModule,
  TelegramNotificationAdapter,
} from './infrastructure/clients/telegram';
import { RabbitMQEventSubscriber } from './infrastructure/messaging/rabbitmq-event.subscriber';
import { StorageModule } from './infrastructure/storage';
import { HealthController } from './health/health.controller';
import { TelegramSmokeController } from './test/telegram-smoke.controller';
import { HANDLE_EVENT_PORT, NOTIFICATION_SENDER_PORT } from './notifier.constants';

@Module({
  imports: [
    AppConfigModule.forRoot(NotifierEnvSchema),
    TerminusModule,
    StorageModule,
    LoggingModule.forHttpAsync('notifier'),
    TelegramClientModule.forRoot(),
  ],
  controllers: [HealthController, TelegramSmokeController],
  providers: [
    notifierConfigProvider,
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
