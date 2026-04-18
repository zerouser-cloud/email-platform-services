export class ListUsersCommand {
  constructor(
    public readonly limit: number,
    public readonly offset: number,
  ) {}
}
