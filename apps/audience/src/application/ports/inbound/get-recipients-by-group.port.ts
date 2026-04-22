import type { GetRecipientsByGroupCommand } from '../../commands/get-recipients-by-group.command';

export interface GetRecipientsByGroupPort {
  execute(cmd: GetRecipientsByGroupCommand): Promise<GetRecipientsByGroupResult>;
}

export interface GetRecipientsByGroupResult {
  readonly recipients: ReadonlyArray<{
    readonly id: string;
    readonly email: string;
    readonly name: string;
    readonly company: string;
    readonly groupId: string;
    readonly isSent: boolean;
    readonly createdAt: string;
  }>;
}
