import { Module, type DynamicModule } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { DRIZZLE, PG_POOL, DATABASE_HEALTH } from './persistence.constants';
import { persistenceProviders } from './persistence.providers';

@Module({})
export class PersistenceModule {
  static forRootAsync(): DynamicModule {
    return {
      module: PersistenceModule,
      imports: [TerminusModule],
      providers: [...persistenceProviders],
      exports: [TerminusModule, DRIZZLE, PG_POOL, DATABASE_HEALTH],
    };
  }
}
