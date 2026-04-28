import { Module } from '@nestjs/common';
import { UserModule } from './user';

/**
 * App-level persistence composer (Phase 999.11.2 D-06). Named AppPersistenceModule
 * to avoid collision with foundation's PersistenceModule (which provides
 * DRIZZLE/PG_POOL/PERSISTENCE_HEALTH). Aggregates per-aggregate sub-modules so the
 * root composition root imports ONE outbound composer.
 */
@Module({
  imports: [UserModule],
  exports: [UserModule],
})
export class AppPersistenceModule {}
