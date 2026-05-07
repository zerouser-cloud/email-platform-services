import { Module, type DynamicModule } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { DRIZZLE, PERSISTENCE_HEALTH } from './persistence.constants';
import { persistenceProviders } from './persistence.providers';

@Module({})
export class PersistenceModule {
  static forRootAsync(): DynamicModule {
    return {
      module: PersistenceModule,
      imports: [TerminusModule],
      providers: [...persistenceProviders],
      // Phase 999.19 F-02: PG_POOL kept private — no narrow-unlock approved.
      // Foundation-internal consumers only: PostgresHealthIndicator (postgres.health.ts)
      // + DrizzleShutdownService (drizzle-shutdown.service.ts). Apps consume DRIZZLE
      // (Tier 1) instead of pg.Pool directly. ESLint Override 4 + Override 5 (Phase
      // 999.19 F-02 V2) ban `from 'pg'` in apps/*/src/** — regression-proofed at
      // lint time. If a future legitimate consumer needs PG_POOL: (1) document the
      // narrow-unlock here symmetric to cache.module.ts:14-18 REDIS_CLIENT D-13,
      // (2) re-add PG_POOL to the exports[] array below, (3) carve a path-specific
      // exception in eslint.config.cjs for the consumer's directory.
      exports: [TerminusModule, DRIZZLE, PERSISTENCE_HEALTH],
    };
  }
}
