import { Module } from '@nestjs/common';
import { PersistenceModule } from '@email-platform/foundation';
import { GROUP_REPOSITORY_PORT } from '../../../../audience.constants';
import { PgGroupRepository } from './pg-group.repository';

/**
 * Per-aggregate persistence sub-module (Phase 999.11.2 D-02).
 * Imports foundation PersistenceModule to make DRIZZLE token visible to
 * PgGroupRepository's @Inject(DRIZZLE). Foundation's PersistenceModule is
 * NOT @Global(), so it must be explicitly imported here.
 *
 * Note: Group aggregate has no dedicated schema yet (stub repository). When
 * real persistence lands, per OQ-3 the group schema will live under
 * outbound/persistence/group/schema/ (dedicated) OR import from
 * ../recipient/schema/ (cross-aggregate — deferred decision).
 */
@Module({
  imports: [PersistenceModule.forRootAsync()],
  providers: [{ provide: GROUP_REPOSITORY_PORT, useClass: PgGroupRepository }],
  exports: [GROUP_REPOSITORY_PORT],
})
export class GroupModule {}
