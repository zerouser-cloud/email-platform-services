import { Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { LoggingModule } from '@email-platform/foundation';
import { NotifierConfigModule } from './infrastructure/bootstrap/config';
import { HealthModule } from './infrastructure/bootstrap/health';
import { RmqModule } from './infrastructure/inbound/rmq';
import { HttpClientsModule } from './infrastructure/outbound/http-clients';
import { AppStorageModule } from './infrastructure/outbound/storage';

@Module({
  imports: [
    // @Global() config module — MUST precede any foundation module that uses
    // nested `SomeExternalModule.forRootAsync({inject: [CONFIG_PORT]})` (Plan 10 Rule 3 fix).
    NotifierConfigModule.forRoot(),
    HealthModule,
    LoggingModule.forHttpAsync('notifier'),
    HttpClientsModule,
    AppStorageModule,
    // RmqModule owns HANDLE_EVENT_PORT + NOTIFICATION_SENDER_PORT bindings
    // (Plan 10 Option A — consumer-cohesive with the RMQ inbound boundary).
    RmqModule,
  ],
  controllers: [],
  providers: [],
})
export class NotifierModule implements OnModuleDestroy {
  private readonly logger = new Logger(NotifierModule.name);

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down notifier service...');
    // TODO: close RabbitMQ subscriber connection
  }
}
