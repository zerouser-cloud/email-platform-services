import { Injectable } from '@nestjs/common';
import type { CreateRunnerCommand } from '../commands/create-runner.command';
import type { CreateRunnerResult } from '../ports/inbound/create-runner.port';

@Injectable()
export class CreateRunnerUseCase {
  async execute(_cmd: CreateRunnerCommand): Promise<CreateRunnerResult> {
    throw new Error('CreateRunnerUseCase not yet implemented');
  }
}
