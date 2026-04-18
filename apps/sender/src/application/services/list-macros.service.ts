import { Injectable } from '@nestjs/common';
import type { ListMacrosPort, ListMacrosResult } from '../ports/inbound/list-macros.port';
import type { ListMacrosCommand } from '../commands/list-macros.command';
import { ListMacrosUseCase } from '../use-cases/list-macros.use-case';

@Injectable()
export class ListMacrosService implements ListMacrosPort {
  constructor(private readonly useCase: ListMacrosUseCase) {}

  async execute(cmd: ListMacrosCommand): Promise<ListMacrosResult> {
    return this.useCase.execute(cmd);
  }
}
