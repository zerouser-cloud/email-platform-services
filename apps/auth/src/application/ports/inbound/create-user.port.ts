import type { CreateUserCommand } from '../../commands/create-user.command';

export interface CreateUserPort {
  execute(cmd: CreateUserCommand): Promise<CreateUserResult>;
}

export interface CreateUserResult {
  readonly id: string;
  readonly email: string;
  readonly role: string;
  readonly organization: string;
  readonly team: string;
  readonly createdAt: string;
}
