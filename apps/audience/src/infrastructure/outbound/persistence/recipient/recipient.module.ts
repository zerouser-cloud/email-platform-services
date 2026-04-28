import { Module } from '@nestjs/common';
import { PersistenceModule } from '@email-platform/foundation';
import { RECIPIENT_REPOSITORY_PORT } from '../../../../audience.constants';
import { PgRecipientRepository } from './pg-recipient.repository';

/**
 * Per-aggregate persistence sub-module (Phase 999.11.2 D-02).
 * Imports foundation PersistenceModule to make DRIZZLE token visible to
 * PgRecipientRepository's @Inject(DRIZZLE). Foundation's PersistenceModule is
 * NOT @Global(), so it must be explicitly imported here.
 */
@Module({
  imports: [PersistenceModule.forRootAsync()],
  providers: [{ provide: RECIPIENT_REPOSITORY_PORT, useClass: PgRecipientRepository }],
  exports: [RECIPIENT_REPOSITORY_PORT],
})
export class RecipientModule {}
