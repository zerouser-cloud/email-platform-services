export class CreateRunnerCommand {
  constructor(
    public readonly name: string,
    public readonly proxyUrl: string,
    public readonly senderEmail: string,
    public readonly senderName: string,
    public readonly intervalSeconds: number,
    public readonly cooldownSeconds: number,
  ) {}
}
