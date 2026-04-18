import { Injectable } from '@nestjs/common';
import type { CreateMessagePort, CreateMessageResult } from '../ports/inbound/create-message.port';
import type { CreateMessageCommand } from '../commands/create-message.command';
import { CreateMessageUseCase } from '../use-cases/create-message.use-case';

@Injectable()
export class CreateMessageService implements CreateMessagePort {
  constructor(private readonly useCase: CreateMessageUseCase) {}

  async execute(cmd: CreateMessageCommand): Promise<CreateMessageResult> {
    return this.useCase.execute(cmd);
  }
}
