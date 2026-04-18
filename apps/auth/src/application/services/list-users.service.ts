import { Injectable } from '@nestjs/common';
import type { ListUsersPort, ListUsersResult } from '../ports/inbound/list-users.port';
import type { ListUsersCommand } from '../commands/list-users.command';
import { ListUsersUseCase } from '../use-cases/list-users.use-case';

@Injectable()
export class ListUsersService implements ListUsersPort {
  constructor(private readonly listUsers: ListUsersUseCase) {}

  async execute(cmd: ListUsersCommand): Promise<ListUsersResult> {
    const result = await this.listUsers.execute(cmd.page, cmd.limit);
    return {
      users: result.users.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        organization: u.organization,
        team: u.team,
        createdAt: '', // stubbed — domain User entity has no createdAt yet
      })),
      total: result.total,
      page: cmd.page,
      limit: cmd.limit,
      pages: 0,
    };
  }
}
