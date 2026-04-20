import { Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { LoggingModule, GrpcToHttpExceptionFilter } from '@email-platform/foundation';
import { GatewayConfigModule } from './infrastructure/bootstrap/config';
import { HealthModule } from './infrastructure/bootstrap/health';
import { ThrottleModule } from './infrastructure/bootstrap/throttle';
import { GrpcClientsModule } from './infrastructure/outbound/grpc-clients';

@Module({
  imports: [
    // @Global() config module — MUST precede any foundation module that uses
    // nested `SomeExternalModule.forRootAsync({inject: [CONFIG_PORT]})` (Plan 10 Rule 3 fix).
    GatewayConfigModule.forRoot(),
    HealthModule,
    ThrottleModule,
    LoggingModule.forHttpAsync('gateway'),
    GrpcClientsModule,
  ],
  controllers: [],
  providers: [GrpcToHttpExceptionFilter],
})
export class GatewayModule implements OnModuleDestroy {
  private readonly logger = new Logger(GatewayModule.name);

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down gateway service...');
    // TODO: drain HTTP server connections
  }
}
