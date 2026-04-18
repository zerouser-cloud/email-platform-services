import type { ListGroupsCommand } from '../../commands/list-groups.command';

export interface ListGroupsPort {
  execute(cmd: ListGroupsCommand): Promise<ListGroupsResult>;
}

export interface ListGroupsResult {
  readonly groups: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly recipientCount: number;
    readonly userId: string;
    readonly createdAt: string;
  }>;
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly pages: number;
}
