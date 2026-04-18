import { Injectable } from '@nestjs/common';
import type { CreateRunnerPort, CreateRunnerResult } from '../ports/inbound/create-runner.port';
import type { CreateRunnerCommand } from '../commands/create-runner.command';
import { CreateRunnerUseCase } from '../use-cases/create-runner.use-case';

@Injectable()
export class CreateRunnerService implements CreateRunnerPort {
  constructor(private readonly useCase: CreateRunnerUseCase) {}

  async execute(cmd: CreateRunnerCommand): Promise<CreateRunnerResult> {
    return this.useCase.execute(cmd);
  }
}
