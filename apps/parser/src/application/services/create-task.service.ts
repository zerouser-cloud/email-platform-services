import { Injectable } from '@nestjs/common';
import type { CreateTaskPort, CreateTaskResult } from '../ports/inbound/create-task.port';
import type { CreateTaskCommand } from '../commands/create-task.command';
import { CreateParserTaskUseCase } from '../use-cases/create-parser-task.use-case';

@Injectable()
export class CreateTaskService implements CreateTaskPort {
  constructor(private readonly useCase: CreateParserTaskUseCase) {}

  async execute(cmd: CreateTaskCommand): Promise<CreateTaskResult> {
    return this.useCase.execute(cmd);
  }
}
