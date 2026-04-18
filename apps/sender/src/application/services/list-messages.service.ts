import { Injectable } from '@nestjs/common';
import type { ListMessagesPort, ListMessagesResult } from '../ports/inbound/list-messages.port';
import type { ListMessagesCommand } from '../commands/list-messages.command';
import { ListMessagesUseCase } from '../use-cases/list-messages.use-case';

@Injectable()
export class ListMessagesService implements ListMessagesPort {
  constructor(private readonly useCase: ListMessagesUseCase) {}

  async execute(cmd: ListMessagesCommand): Promise<ListMessagesResult> {
    return this.useCase.execute(cmd);
  }
}
