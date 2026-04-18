import { Injectable } from '@nestjs/common';
import type { GetTaskPort } from '../ports/inbound/get-task.port';
import type { CreateTaskResult } from '../ports/inbound/create-task.port';
import type { GetTaskCommand } from '../commands/get-task.command';
import { GetParserTaskUseCase } from '../use-cases/get-parser-task.use-case';

@Injectable()
export class GetTaskService implements GetTaskPort {
  constructor(private readonly useCase: GetParserTaskUseCase) {}

  async execute(cmd: GetTaskCommand): Promise<CreateTaskResult> {
    return this.useCase.execute(cmd);
  }
}
