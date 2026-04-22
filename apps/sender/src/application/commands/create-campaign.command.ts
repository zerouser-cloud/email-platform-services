export class CreateCampaignCommand {
  constructor(
    public readonly name: string,
    public readonly messageId: string,
    public readonly runnerId: string,
    public readonly groupId: string,
    public readonly userId: string,
  ) {}
}
