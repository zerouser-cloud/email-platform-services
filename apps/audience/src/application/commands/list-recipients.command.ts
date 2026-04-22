export class ListRecipientsCommand {
  constructor(
    public readonly page: number,
    public readonly limit: number,
    public readonly groupId: string,
  ) {}
}
