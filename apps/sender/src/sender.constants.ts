// Outbound ports (adapters — one per aggregate)
export const CAMPAIGN_REPOSITORY_PORT = Symbol('CampaignRepositoryPort');

// Inbound ports (one per proto RPC method; healthCheck stays stubbed in controller — no port)
export const LIST_CAMPAIGNS_PORT = Symbol('ListCampaignsPort');
export const GET_CAMPAIGN_PORT = Symbol('GetCampaignPort');
export const CREATE_CAMPAIGN_PORT = Symbol('CreateCampaignPort');
export const PAUSE_CAMPAIGN_PORT = Symbol('PauseCampaignPort');
export const RESUME_CAMPAIGN_PORT = Symbol('ResumeCampaignPort');
export const LIST_RUNNERS_PORT = Symbol('ListRunnersPort');
export const CREATE_RUNNER_PORT = Symbol('CreateRunnerPort');
export const LIST_MESSAGES_PORT = Symbol('ListMessagesPort');
export const CREATE_MESSAGE_PORT = Symbol('CreateMessagePort');
export const LIST_MACROS_PORT = Symbol('ListMacrosPort');

// Pagination defaults applied at the proto->Command boundary when the client omits pagination.
// Real pagination policy is deferred until business logic lands; these are conservative stubs.
export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
} as const;
