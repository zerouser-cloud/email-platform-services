import { Injectable } from '@nestjs/common';
import type { ListMessagesCommand } from '../commands/list-messages.command';
import type { ListMessagesResult } from '../ports/inbound/list-messages.port';

@Injectable()
export class ListMessagesUseCase {
  async execute(_cmd: ListMessagesCommand): Promise<ListMessagesResult> {
    throw new Error('ListMessagesUseCase not yet implemented');
  }
}
