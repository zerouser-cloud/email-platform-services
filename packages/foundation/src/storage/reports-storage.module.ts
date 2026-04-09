import { Module, type DynamicModule } from '@nestjs/common';
import { REPORTS_STORAGE } from './storage.constants';
import { StorageModule } from './storage.module';

@Module({})
export class ReportsStorageModule {
  static forRootAsync(): DynamicModule {
    return StorageModule.forRootAsync({
      bucket: 'reports',
      token: REPORTS_STORAGE,
    });
  }
}
