export class ListMessagesCommand {
  constructor(
    public readonly page: number,
    public readonly limit: number,
  ) {}
}
