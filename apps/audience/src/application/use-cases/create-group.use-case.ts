import { Inject, Injectable } from '@nestjs/common';
import type { CreateGroupCommand } from '../commands/create-group.command';
import type { CreateGroupResult } from '../ports/inbound/create-group.port';
import type { GroupRepositoryPort } from '../ports/outbound/group-repository.port';
import { GROUP_REPOSITORY_PORT } from '../../audience.constants';

@Injectable()
export class CreateGroupUseCase {
  constructor(
    @Inject(GROUP_REPOSITORY_PORT)
    private readonly _groups: GroupRepositoryPort,
  ) {}

  async execute(_cmd: CreateGroupCommand): Promise<CreateGroupResult> {
    throw new Error('CreateGroupUseCase not yet implemented');
  }
}
