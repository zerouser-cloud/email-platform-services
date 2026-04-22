import type { CreateGroupCommand } from '../../commands/create-group.command';

export interface CreateGroupPort {
  execute(cmd: CreateGroupCommand): Promise<CreateGroupResult>;
}

export interface CreateGroupResult {
  readonly id: string;
  readonly name: string;
  readonly recipientCount: number;
  readonly userId: string;
  readonly createdAt: string;
}
