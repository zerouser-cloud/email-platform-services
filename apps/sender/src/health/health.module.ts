import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { PersistenceModule, RedisHealthIndicator } from '@email-platform/foundation';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule, PersistenceModule.forRootAsync()],
  controllers: [HealthController],
  providers: [RedisHealthIndicator],
})
export class HealthModule {}
