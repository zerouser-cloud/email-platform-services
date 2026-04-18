import type { ListRunnersCommand } from '../../commands/list-runners.command';

export interface ListRunnersPort {
  execute(cmd: ListRunnersCommand): Promise<ListRunnersResult>;
}

export interface ListRunnersResult {
  readonly runners: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly proxyUrl: string;
    readonly senderEmail: string;
    readonly senderName: string;
    readonly intervalSeconds: number;
    readonly cooldownSeconds: number;
    readonly createdAt: string;
  }>;
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly pages: number;
}
