export class ListCampaignsCommand {
  constructor(
    public readonly page: number,
    public readonly limit: number,
    public readonly userId: string,
  ) {}
}
