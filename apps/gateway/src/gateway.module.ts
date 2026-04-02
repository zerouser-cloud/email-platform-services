import { Module } from '@nestjs/common';
import { AppConfigModule } from '@email-platform/config';
import { LoggingModule, GrpcToHttpExceptionFilter } from '@email-platform/foundation';
import { HealthModule } from './health/health.module';
import { ThrottleModule } from './throttle/throttle.module';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule.forHttpAsync(),
    ThrottleModule,
    HealthModule,
  ],
  providers: [GrpcToHttpExceptionFilter],
})
export class GatewayModule {}
