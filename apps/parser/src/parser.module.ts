import { Module } from '@nestjs/common';
import { AppConfigModule } from '@email-platform/config';
import { LoggingModule } from '@email-platform/foundation';
import { ParserController } from './parser.controller';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule.forGrpcAsync(),
    HealthModule,
  ],
  controllers: [ParserController],
})
export class ParserModule {}
