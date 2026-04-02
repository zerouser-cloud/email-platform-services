import { Module } from '@nestjs/common';
import { AppConfigModule } from '@email-platform/config';
import { LoggingModule } from '@email-platform/foundation';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule.forHttpAsync(),
    HealthModule,
  ],
})
export class NotifierModule {}
