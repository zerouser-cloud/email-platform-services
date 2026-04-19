import { Inject, Injectable } from '@nestjs/common';
import type { ListTasksCommand } from '../commands/list-tasks.command';
import type { ListTasksResult } from '../ports/inbound/list-tasks.port';
import type { ParserTaskRepositoryPort } from '../ports/outbound/parser-task-repository.port';
import { PARSER_TASK_REPOSITORY_PORT } from '../../parser.constants';

@Injectable()
export class ListParserTasksUseCase {
  constructor(
    @Inject(PARSER_TASK_REPOSITORY_PORT)
    private readonly parserTaskRepository: ParserTaskRepositoryPort,
  ) {}

  async execute(_cmd: ListTasksCommand): Promise<ListTasksResult> {
    throw new Error('ListParserTasksUseCase not yet implemented');
  }
}
