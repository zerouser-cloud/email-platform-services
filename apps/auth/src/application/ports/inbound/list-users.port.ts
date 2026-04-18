import type { ListUsersCommand } from '../../commands/list-users.command';

export interface ListUsersPort {
  execute(cmd: ListUsersCommand): Promise<ListUsersResult>;
}

export interface ListUsersResult {
  readonly users: ReadonlyArray<{
    readonly id: string;
    readonly email: string;
    readonly role: string;
    readonly organization: string;
    readonly team: string;
    readonly createdAt: number;
  }>;
  readonly total: number;
}
