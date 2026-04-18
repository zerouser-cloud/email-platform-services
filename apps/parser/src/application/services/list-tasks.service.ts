import { Injectable } from '@nestjs/common';
import type { ListTasksPort, ListTasksResult } from '../ports/inbound/list-tasks.port';
import type { ListTasksCommand } from '../commands/list-tasks.command';
import { ListParserTasksUseCase } from '../use-cases/list-parser-tasks.use-case';

@Injectable()
export class ListTasksService implements ListTasksPort {
  constructor(private readonly useCase: ListParserTasksUseCase) {}

  async execute(cmd: ListTasksCommand): Promise<ListTasksResult> {
    return this.useCase.execute(cmd);
  }
}
