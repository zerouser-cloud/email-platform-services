import { Module, type DynamicModule } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { CACHE_SERVICE, REDIS_HEALTH } from './cache.constants';
import type { CacheModuleOptions } from './cache.interfaces';
import { cacheProviders } from './cache.providers';

@Module({})
export class CacheModule {
  static forRootAsync(options: CacheModuleOptions): DynamicModule {
    return {
      module: CacheModule,
      imports: [TerminusModule],
      providers: [...cacheProviders(options)],
      exports: [TerminusModule, CACHE_SERVICE, REDIS_HEALTH],
    };
  }
}
