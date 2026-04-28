import { Injectable } from '@nestjs/common';
import type { CreateMessageCommand } from '../commands/create-message.command';
import type { CreateMessageResult } from '../ports/inbound/create-message.port';

@Injectable()
export class CreateMessageUseCase {
  async execute(_cmd: CreateMessageCommand): Promise<CreateMessageResult> {
    throw new Error('CreateMessageUseCase not yet implemented');
  }
}
