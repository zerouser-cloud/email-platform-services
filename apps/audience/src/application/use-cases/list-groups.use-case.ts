import { Inject, Injectable } from '@nestjs/common';
import type { ListGroupsCommand } from '../commands/list-groups.command';
import type { ListGroupsResult } from '../ports/inbound/list-groups.port';
import type { GroupRepositoryPort } from '../ports/outbound/group-repository.port';
import { GROUP_REPOSITORY_PORT } from '../../audience.constants';

@Injectable()
export class ListGroupsUseCase {
  constructor(
    @Inject(GROUP_REPOSITORY_PORT)
    private readonly _groups: GroupRepositoryPort,
  ) {}

  async execute(_cmd: ListGroupsCommand): Promise<ListGroupsResult> {
    throw new Error('ListGroupsUseCase not yet implemented');
  }
}
