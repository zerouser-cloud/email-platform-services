import { Module } from '@nestjs/common';
import { PersistenceModule } from '@email-platform/foundation';
import { USER_REPOSITORY_PORT } from '../../../../auth.constants';
import { PgUserRepository } from './pg-user.repository';

/**
 * Per-aggregate persistence sub-module (Phase 999.11.2 D-02).
 * Imports foundation PersistenceModule to make DRIZZLE token visible to
 * PgUserRepository's @Inject(DRIZZLE). Foundation's PersistenceModule is
 * NOT @Global(), so it must be explicitly imported here.
 */
@Module({
  imports: [PersistenceModule.forRootAsync()],
  providers: [{ provide: USER_REPOSITORY_PORT, useClass: PgUserRepository }],
  exports: [USER_REPOSITORY_PORT],
})
export class UserModule {}
