export class CreateMessageCommand {
  constructor(
    public readonly subject: string,
    public readonly body: string,
    public readonly userId: string,
  ) {}
}
