import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { MongoHealthIndicator, RedisHealthIndicator } from '@email-platform/foundation';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [MongoHealthIndicator, RedisHealthIndicator],
})
export class HealthModule {}
