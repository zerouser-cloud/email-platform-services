import { Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { AppConfigModule } from '@email-platform/config';
import { LoggingModule } from '@email-platform/foundation';
import { HealthModule } from './health/health.module';
import { HandleEventUseCase } from './application/use-cases/handle-event.use-case';
import { TelegramNotificationSender } from './infrastructure/external/telegram-notification.sender';
import { RabbitMQEventSubscriber } from './infrastructure/messaging/rabbitmq-event.subscriber';

export const HANDLE_EVENT_PORT = 'HandleEventPort';
export const NOTIFICATION_SENDER_PORT = 'NotificationSenderPort';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule.forHttpAsync('notifier'),
    HealthModule,
  ],
  providers: [
    { provide: NOTIFICATION_SENDER_PORT, useClass: TelegramNotificationSender },
    { provide: HANDLE_EVENT_PORT, useClass: HandleEventUseCase },
    RabbitMQEventSubscriber,
  ],
})
export class NotifierModule implements OnModuleDestroy {
  private readonly logger = new Logger(NotifierModule.name);

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down notifier service...');
    // TODO: close RabbitMQ subscriber connection
  }
}
