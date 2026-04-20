import { Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { LoggingModule, GrpcToHttpExceptionFilter } from '@email-platform/foundation';
import { GatewayConfigModule } from './infrastructure/config';
import { ThrottleModule } from './infrastructure/throttle/throttle.module';
import { GrpcClientsModule } from './infrastructure/clients/grpc-clients.module';
import { HealthController } from './infrastructure/controllers/rest/health.controller';

@Module({
  imports: [
    // @Global() config module — MUST precede any foundation module that uses
    // nested `SomeExternalModule.forRootAsync({inject: [CONFIG_PORT]})` (Plan 10 Rule 3 fix).
    GatewayConfigModule.forRoot(),
    TerminusModule,
    LoggingModule.forHttpAsync('gateway'),
    ThrottleModule,
    GrpcClientsModule,
  ],
  controllers: [HealthController],
  providers: [GrpcToHttpExceptionFilter],
})
export class GatewayModule implements OnModuleDestroy {
  private readonly logger = new Logger(GatewayModule.name);

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down gateway service...');
    // TODO: drain HTTP server connections
  }
}
