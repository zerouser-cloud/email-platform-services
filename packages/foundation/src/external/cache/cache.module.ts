import { Module, type DynamicModule } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { CACHE_SERVICE, REDIS_HEALTH, REDIS_CLIENT } from './cache.constants';
import type { CacheModuleOptions } from './cache.interfaces';
import { cacheProviders } from './cache.providers';

@Module({})
export class CacheModule {
  static forRootAsync(options: CacheModuleOptions): DynamicModule {
    return {
      module: CacheModule,
      imports: [TerminusModule],
      providers: [...cacheProviders(options)],
      // Phase 999.12 D-13: REDIS_CLIENT exposed for @nest-lab/throttler-storage-redis (gateway throttle).
      // Phase 21 D-04 amended in 999.12 — narrow public unlock for one library-owned consumer.
      // ESLint Override 4 (Phase 999.12 D-08) blocks raw ioredis imports in apps/* — the
      // regression D-04 was protecting against is structurally prevented at lint time.
      exports: [TerminusModule, CACHE_SERVICE, REDIS_HEALTH, REDIS_CLIENT],
    };
  }
}
