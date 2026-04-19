import { Injectable } from '@nestjs/common';
import type { ListTasksPort, ListTasksResult } from '../ports/inbound/list-tasks.port';
import type { ListTasksCommand } from '../commands/list-tasks.command';
import { ListParserTasksUseCase } from '../use-cases/list-parser-tasks.use-case';

@Injectable()
export class ListTasksService implements ListTasksPort {
  constructor(private readonly listParserTasks: ListParserTasksUseCase) {}

  async execute(cmd: ListTasksCommand): Promise<ListTasksResult> {
    return this.listParserTasks.execute(cmd);
  }
}
