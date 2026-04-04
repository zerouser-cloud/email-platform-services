import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { PersistenceModule } from '@email-platform/foundation';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule, PersistenceModule.forRootAsync()],
  controllers: [HealthController],
})
export class HealthModule {}
