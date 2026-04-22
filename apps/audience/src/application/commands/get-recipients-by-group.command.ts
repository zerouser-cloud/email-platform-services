export class GetRecipientsByGroupCommand {
  constructor(
    public readonly groupId: string,
    public readonly onlyUnsent: boolean,
  ) {}
}
