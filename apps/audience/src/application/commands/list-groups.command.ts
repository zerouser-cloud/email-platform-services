export class ListGroupsCommand {
  constructor(
    public readonly page: number,
    public readonly limit: number,
    public readonly userId: string,
  ) {}
}
