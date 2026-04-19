import { Injectable } from '@nestjs/common';
import type { CreateGroupPort, CreateGroupResult } from '../ports/inbound/create-group.port';
import type { CreateGroupCommand } from '../commands/create-group.command';
import { CreateGroupUseCase } from '../use-cases/create-group.use-case';

@Injectable()
export class CreateGroupService implements CreateGroupPort {
  constructor(private readonly createGroup: CreateGroupUseCase) {}

  async execute(cmd: CreateGroupCommand): Promise<CreateGroupResult> {
    return this.createGroup.execute(cmd);
  }
}
