import { Module } from '@nestjs/common';
import { AppConfigModule } from '@email-platform/config';
import { LoggingModule, GrpcToHttpExceptionFilter } from '@email-platform/foundation';
import { HealthModule } from './health/health.module';
import { ThrottleModule } from './throttle/throttle.module';
import { GrpcClientsModule } from './infrastructure/clients/grpc-clients.module';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule.forHttpAsync('gateway'),
    ThrottleModule,
    HealthModule,
    GrpcClientsModule,
  ],
  providers: [GrpcToHttpExceptionFilter],
})
export class GatewayModule {}
