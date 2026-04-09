import { Module, type DynamicModule } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { STORAGE_HEALTH } from './storage.constants';
import type { StorageModuleOptions } from './storage.interfaces';
import { storageProviders } from './storage.providers';

@Module({})
export class StorageModule {
  static forRootAsync(options: StorageModuleOptions): DynamicModule {
    return {
      module: StorageModule,
      imports: [TerminusModule],
      providers: [...storageProviders(options)],
      exports: [TerminusModule, options.token, STORAGE_HEALTH],
    };
  }
}
