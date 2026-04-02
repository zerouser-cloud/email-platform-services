export interface CreateCampaignPort {
  execute(name: string): Promise<CreateCampaignResult>;
}

export interface CreateCampaignResult {
  id: string;
  name: string;
  status: string;
}
