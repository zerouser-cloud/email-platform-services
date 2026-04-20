import { Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { NotifierConfigModule } from './infrastructure/config';
import { LoggingModule, RabbitMqHealthIndicator } from '@email-platform/foundation';
import { HandleEventUseCase } from './application/use-cases/handle-event.use-case';
import {
  TelegramClientModule,
  TelegramNotificationAdapter,
} from './infrastructure/clients/telegram';
import { RabbitMQEventSubscriber } from './infrastructure/messaging/rabbitmq-event.subscriber';
import { StorageModule } from './infrastructure/storage';
import { HealthController } from './infrastructure/controllers/rest/health.controller';
import { HANDLE_EVENT_PORT, NOTIFICATION_SENDER_PORT } from './notifier.constants';

@Module({
  imports: [
    // @Global() config module — MUST precede any foundation module that uses
    // nested `SomeExternalModule.forRootAsync({inject: [CONFIG_PORT]})` (Plan 10 Rule 3 fix).
    NotifierConfigModule.forRoot(),
    TerminusModule,
    StorageModule,
    LoggingModule.forHttpAsync('notifier'),
    TelegramClientModule.forRoot(),
  ],
  controllers: [HealthController],
  providers: [
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
