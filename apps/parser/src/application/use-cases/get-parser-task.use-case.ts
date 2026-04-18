import { Inject, Injectable } from '@nestjs/common';
import type { GetTaskCommand } from '../commands/get-task.command';
import type { CreateTaskResult } from '../ports/inbound/create-task.port';
import type { ParserTaskRepositoryPort } from '../ports/outbound/parser-task-repository.port';
import { PARSER_TASK_REPOSITORY_PORT } from '../../parser.constants';

@Injectable()
export class GetParserTaskUseCase {
  constructor(
    @Inject(PARSER_TASK_REPOSITORY_PORT)
    private readonly tasks: ParserTaskRepositoryPort,
  ) {}

  async execute(_cmd: GetTaskCommand): Promise<CreateTaskResult> {
    throw new Error('GetParserTaskUseCase not yet implemented');
  }
}
