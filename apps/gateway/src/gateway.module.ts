import { Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { AppConfigModule } from '@email-platform/config';
import { GatewayEnvSchema, gatewayConfigProvider } from './infrastructure/config';
import { TerminusModule } from '@nestjs/terminus';
import {
  LoggingModule,
  GrpcToHttpExceptionFilter,
  LOGGING_CONFIG_PORT,
  type LoggingConfig,
} from '@email-platform/foundation';
import { ThrottleModule } from './infrastructure/throttle/throttle.module';
import { GrpcClientsModule } from './infrastructure/clients/grpc-clients.module';
import { HealthController } from './infrastructure/controllers/rest/health.controller';
import { GATEWAY_CONFIG } from './gateway.constants';
import type { GatewayEnv } from './infrastructure/config';

@Module({
  imports: [
    AppConfigModule.forRoot(GatewayEnvSchema),
    TerminusModule,
    LoggingModule.forHttpAsync('gateway'),
    ThrottleModule,
    GrpcClientsModule,
  ],
  controllers: [HealthController],
  providers: [
    gatewayConfigProvider,
    // Canonical Config Access Contract (Phase 999.11.1 D-10) — narrow config slices.
    {
      provide: LOGGING_CONFIG_PORT,
      useFactory: (c: GatewayEnv): LoggingConfig => ({
        LOG_LEVEL: c.LOG_LEVEL,
        LOG_FORMAT: c.LOG_FORMAT,
      }),
      inject: [GATEWAY_CONFIG],
    },
    GrpcToHttpExceptionFilter,
  ],
})
export class GatewayModule implements OnModuleDestroy {
  private readonly logger = new Logger(GatewayModule.name);

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down gateway service...');
    // TODO: drain HTTP server connections
  }
}
