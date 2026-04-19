import { Inject, Injectable } from '@nestjs/common';
import type { DeleteGroupCommand } from '../commands/delete-group.command';
import type { GroupRepositoryPort } from '../ports/outbound/group-repository.port';
import { GROUP_REPOSITORY_PORT } from '../../audience.constants';

@Injectable()
export class DeleteGroupUseCase {
  constructor(
    @Inject(GROUP_REPOSITORY_PORT)
    private readonly groupRepository: GroupRepositoryPort,
  ) {}

  async execute(_cmd: DeleteGroupCommand): Promise<void> {
    throw new Error('DeleteGroupUseCase not yet implemented');
  }
}
