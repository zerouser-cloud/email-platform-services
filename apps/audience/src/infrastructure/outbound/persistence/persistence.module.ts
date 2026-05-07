import { Module } from '@nestjs/common';
import { RecipientModule } from './recipient';
import { GroupModule } from './group';

/**
 * App-level persistence composer (Phase 999.11.2 D-06). Named AppPersistenceModule
 * to avoid collision with foundation's PersistenceModule (which provides DRIZZLE +
 * PERSISTENCE_HEALTH publicly; PG_POOL kept foundation-internal per Phase 999.19
 * F-02). First real **multi-sub** demo — aggregates RecipientModule + GroupModule
 * so the root composition root imports ONE outbound composer.
 */
@Module({
  imports: [RecipientModule, GroupModule],
  exports: [RecipientModule, GroupModule],
})
export class AppPersistenceModule {}
