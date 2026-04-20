import { Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { LoggingModule } from '@email-platform/foundation';
import { NotifierConfigModule } from './infrastructure/bootstrap/config';
import { HealthModule } from './infrastructure/bootstrap/health';
import { RmqModule } from './infrastructure/inbound/rmq';
import { HttpClientsModule } from './infrastructure/outbound/http-clients';
import { AppStorageModule } from './infrastructure/outbound/storage';
import { TelegramNotificationAdapter } from './infrastructure/outbound/http-clients/telegram';
import { NOTIFICATION_SENDER_PORT } from './notifier.constants';

@Module({
  imports: [
    // @Global() config module — MUST precede any foundation module that uses
    // nested `SomeExternalModule.forRootAsync({inject: [CONFIG_PORT]})` (Plan 10 Rule 3 fix).
    NotifierConfigModule.forRoot(),
    HealthModule,
    LoggingModule.forHttpAsync('notifier'),
    HttpClientsModule,
    AppStorageModule,
    RmqModule,
  ],
  controllers: [],
  providers: [
    // OQ-5: NOTIFICATION_SENDER_PORT binding stays at the composition root —
    // TelegramNotificationAdapter is an outbound adapter used by application
    // services (not just the RMQ inbound consumer), so keeping the binding
    // here avoids coupling it to a specific inbound boundary.
    { provide: NOTIFICATION_SENDER_PORT, useClass: TelegramNotificationAdapter },
    // HANDLE_EVENT_PORT binding moved into RmqModule (cohesive with EventConsumer).
    // RabbitMqHealthIndicator provider owned by HealthModule.
  ],
})
export class NotifierModule implements OnModuleDestroy {
  private readonly logger = new Logger(NotifierModule.name);

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down notifier service...');
    // TODO: close RabbitMQ subscriber connection
  }
}
