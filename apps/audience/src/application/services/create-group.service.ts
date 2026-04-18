import { Injectable } from '@nestjs/common';
import type { CreateGroupPort, CreateGroupResult } from '../ports/inbound/create-group.port';
import type { CreateGroupCommand } from '../commands/create-group.command';
import { CreateGroupUseCase } from '../use-cases/create-group.use-case';

@Injectable()
export class CreateGroupService implements CreateGroupPort {
  constructor(private readonly useCase: CreateGroupUseCase) {}

  async execute(cmd: CreateGroupCommand): Promise<CreateGroupResult> {
    return this.useCase.execute(cmd);
  }
}
