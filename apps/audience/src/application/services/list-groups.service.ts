import { Injectable } from '@nestjs/common';
import type { ListGroupsPort, ListGroupsResult } from '../ports/inbound/list-groups.port';
import type { ListGroupsCommand } from '../commands/list-groups.command';
import { ListGroupsUseCase } from '../use-cases/list-groups.use-case';

@Injectable()
export class ListGroupsService implements ListGroupsPort {
  constructor(private readonly listGroups: ListGroupsUseCase) {}

  async execute(cmd: ListGroupsCommand): Promise<ListGroupsResult> {
    return this.listGroups.execute(cmd);
  }
}
