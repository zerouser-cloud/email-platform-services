import type { CreateMessageCommand } from '../../commands/create-message.command';

export interface CreateMessagePort {
  execute(cmd: CreateMessageCommand): Promise<CreateMessageResult>;
}

export interface CreateMessageResult {
  readonly id: string;
  readonly subject: string;
  readonly body: string;
  readonly userId: string;
  readonly createdAt: string;
}
