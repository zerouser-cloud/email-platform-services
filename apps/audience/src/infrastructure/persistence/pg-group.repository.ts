import { Inject, Injectable } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '@email-platform/foundation';
import type { GroupRepositoryPort } from '../../application/ports/outbound/group-repository.port';
import type { Group } from '../../domain/entities/group.entity';

/**
 * Stub adapter — no Drizzle `groups` schema exists yet. Per PROJECT.md
 * ("каркас без бизнес-логики"), the repository contract is established here;
 * implementation arrives with the business-logic phase.
 */
@Injectable()
export class PgGroupRepository implements GroupRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly _db: NodePgDatabase) {}

  async findAll(
    _limit: number,
    _offset: number,
    _userId: string,
  ): Promise<{ readonly groups: ReadonlyArray<Group>; readonly total: number }> {
    throw new Error('PgGroupRepository.findAll not yet implemented');
  }

  async findById(_id: string): Promise<Group | null> {
    throw new Error('PgGroupRepository.findById not yet implemented');
  }

  async save(_group: Group): Promise<void> {
    throw new Error('PgGroupRepository.save not yet implemented');
  }

  async deleteById(_id: string): Promise<void> {
    throw new Error('PgGroupRepository.deleteById not yet implemented');
  }
}
