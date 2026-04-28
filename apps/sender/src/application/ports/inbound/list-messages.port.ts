import type { ListMessagesCommand } from '../../commands/list-messages.command';

export interface ListMessagesPort {
  execute(cmd: ListMessagesCommand): Promise<ListMessagesResult>;
}

export interface ListMessagesResult {
  readonly messages: ReadonlyArray<{
    readonly id: string;
    readonly subject: string;
    readonly body: string;
    readonly userId: string;
    readonly createdAt: string;
  }>;
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly pages: number;
}
