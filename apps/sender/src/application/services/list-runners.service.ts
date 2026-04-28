import { Injectable } from '@nestjs/common';
import type { ListRunnersPort, ListRunnersResult } from '../ports/inbound/list-runners.port';
import type { ListRunnersCommand } from '../commands/list-runners.command';
import { ListRunnersUseCase } from '../use-cases/list-runners.use-case';

@Injectable()
export class ListRunnersService implements ListRunnersPort {
  constructor(private readonly listRunners: ListRunnersUseCase) {}

  async execute(cmd: ListRunnersCommand): Promise<ListRunnersResult> {
    return this.listRunners.execute(cmd);
  }
}
