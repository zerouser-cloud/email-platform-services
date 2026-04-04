import { Module, type DynamicModule } from '@nestjs/common';
import { DrizzleModule } from './drizzle.module';
import { PostgresHealthModule } from './postgres-health.module';

@Module({})
export class PersistenceModule {
  static forRootAsync(): DynamicModule {
    return {
      module: PersistenceModule,
      imports: [DrizzleModule.forRootAsync(), PostgresHealthModule],
      exports: [DrizzleModule, PostgresHealthModule],
    };
  }
}
