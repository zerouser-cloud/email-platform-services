import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { MongoHealthIndicator } from '@email-platform/foundation';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [MongoHealthIndicator],
})
export class HealthModule {}
