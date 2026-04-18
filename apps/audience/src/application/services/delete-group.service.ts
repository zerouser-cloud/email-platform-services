import { Injectable } from '@nestjs/common';
import type { DeleteGroupPort } from '../ports/inbound/delete-group.port';
import type { DeleteGroupCommand } from '../commands/delete-group.command';
import { DeleteGroupUseCase } from '../use-cases/delete-group.use-case';

@Injectable()
export class DeleteGroupService implements DeleteGroupPort {
  constructor(private readonly useCase: DeleteGroupUseCase) {}

  async execute(cmd: DeleteGroupCommand): Promise<void> {
    await this.useCase.execute(cmd);
  }
}
