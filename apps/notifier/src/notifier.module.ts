import { Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { AppConfigModule } from '@email-platform/config';
import { NotifierEnvSchema } from './infrastructure/config';
import { LoggingModule, RabbitMqHealthIndicator } from '@email-platform/foundation';
import { HandleEventUseCase } from './application/use-cases/handle-event.use-case';
import { TelegramNotificationSender } from './infrastructure/external/telegram-notification.sender';
import { RabbitMQEventSubscriber } from './infrastructure/messaging/rabbitmq-event.subscriber';
import { HealthController } from './health/health.controller';
import { HANDLE_EVENT_PORT, NOTIFICATION_SENDER_PORT } from './notifier.constants';

@Module({
  imports: [AppConfigModule.forRoot(NotifierEnvSchema), TerminusModule, LoggingModule.forHttpAsync('notifier')],
  controllers: [HealthController],
  providers: [
    { provide: NOTIFICATION_SENDER_PORT, useClass: TelegramNotificationSender },
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
