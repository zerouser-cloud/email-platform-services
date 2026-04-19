import { Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { AppConfigModule } from '@email-platform/config';
import { GatewayEnvSchema } from './infrastructure/config';
import { TerminusModule } from '@nestjs/terminus';
import { LoggingModule, GrpcToHttpExceptionFilter } from '@email-platform/foundation';
import { ThrottleModule } from './throttle/throttle.module';
import { GrpcClientsModule } from './infrastructure/clients/grpc-clients.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    AppConfigModule.forRoot(GatewayEnvSchema),
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
