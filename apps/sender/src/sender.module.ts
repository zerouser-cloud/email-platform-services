import { Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { LoggingModule } from '@email-platform/foundation';
import { SenderConfigModule } from './infrastructure/bootstrap/config';
import { HealthModule } from './infrastructure/bootstrap/health';
import { GrpcModule } from './infrastructure/inbound/grpc';
import { GrpcClientsModule } from './infrastructure/outbound/grpc-clients';
import { HttpClientsModule } from './infrastructure/outbound/http-clients';

@Module({
  imports: [
    // @Global() config module — MUST precede any foundation module that uses
    // nested `SomeExternalModule.forRootAsync({inject: [CONFIG_PORT]})` (Plan 10 Rule 3 fix).
    SenderConfigModule.forRoot(),
    HealthModule,
    LoggingModule.forGrpcAsync('sender'),
    GrpcClientsModule,
    HttpClientsModule,
    // GrpcModule owns inbound port → service bindings + use-cases + outbound
    // AppPersistenceModule (Plan 10 Option A — cohesion with D-02).
    GrpcModule,
  ],
  controllers: [],
  providers: [],
})
export class SenderModule implements OnModuleDestroy {
  private readonly logger = new Logger(SenderModule.name);

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down sender service...');
  }
}
