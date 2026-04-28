export class CreateTaskCommand {
  constructor(
    public readonly category: string,
    public readonly dateFrom: string,
    public readonly dateTo: string,
    public readonly userId: string,
  ) {}
}
