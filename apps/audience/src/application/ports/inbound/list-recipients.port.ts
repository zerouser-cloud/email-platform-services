import type { ListRecipientsCommand } from '../../commands/list-recipients.command';

export interface ListRecipientsPort {
  execute(cmd: ListRecipientsCommand): Promise<ListRecipientsResult>;
}

export interface ListRecipientsResult {
  readonly recipients: ReadonlyArray<{
    readonly id: string;
    readonly email: string;
    readonly name: string;
    readonly company: string;
    readonly groupId: string;
    readonly isSent: boolean;
    readonly createdAt: string;
  }>;
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly pages: number;
}
