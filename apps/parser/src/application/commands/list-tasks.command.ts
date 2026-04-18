export class ListTasksCommand {
  constructor(
    public readonly page: number,
    public readonly limit: number,
    public readonly userId: string,
  ) {}
}
