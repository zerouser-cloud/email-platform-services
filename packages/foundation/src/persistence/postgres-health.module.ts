import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { PostgresHealthIndicator } from './postgres.health';
import { DATABASE_HEALTH } from './persistence.constants';

@Module({
  imports: [TerminusModule],
  providers: [
    PostgresHealthIndicator,
    { provide: DATABASE_HEALTH, useExisting: PostgresHealthIndicator },
  ],
  exports: [DATABASE_HEALTH],
})
export class PostgresHealthModule {}
