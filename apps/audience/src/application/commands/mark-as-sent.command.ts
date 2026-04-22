export class MarkAsSentCommand {
  constructor(public readonly recipientIds: ReadonlyArray<string>) {}
}
