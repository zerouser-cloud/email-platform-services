export class ListRunnersCommand {
  constructor(
    public readonly page: number,
    public readonly limit: number,
  ) {}
}
