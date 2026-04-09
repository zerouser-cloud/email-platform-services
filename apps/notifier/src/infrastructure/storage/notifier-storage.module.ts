import { Module, type DynamicModule } from '@nestjs/common';
import { ReportsStorageModule } from '@email-platform/foundation';

@Module({})
export class NotifierStorageModule {
  static forRootAsync(): DynamicModule {
    return {
      module: NotifierStorageModule,
      imports: [ReportsStorageModule.forRootAsync()],
      exports: [ReportsStorageModule],
    };
  }
}
