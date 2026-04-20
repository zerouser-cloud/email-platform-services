// Outbound ports (adapters — one per aggregate)
export const RECIPIENT_REPOSITORY_PORT = Symbol('RecipientRepositoryPort');
export const GROUP_REPOSITORY_PORT = Symbol('GroupRepositoryPort');

// Inbound ports (one per proto RPC method; healthCheck stays stubbed in controller — no port)
export const LIST_GROUPS_PORT = Symbol('ListGroupsPort');
export const CREATE_GROUP_PORT = Symbol('CreateGroupPort');
export const DELETE_GROUP_PORT = Symbol('DeleteGroupPort');
export const LIST_RECIPIENTS_PORT = Symbol('ListRecipientsPort');
export const GET_RECIPIENTS_BY_GROUP_PORT = Symbol('GetRecipientsByGroupPort');
export const IMPORT_RECIPIENTS_PORT = Symbol('ImportRecipientsPort');
export const MARK_AS_SENT_PORT = Symbol('MarkAsSentPort');
export const RESET_SEND_STATUS_PORT = Symbol('ResetSendStatusPort');

// Canonical Config Access Contract (Phase 999.11.1 D-08) — per-service {SVC}_CONFIG Symbol.
export const AUDIENCE_CONFIG = Symbol('AUDIENCE_CONFIG');

// Pagination defaults applied at the proto->Command boundary when the client omits pagination.
// Real audience pagination policy is deferred until business logic lands; these are conservative stubs.
export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
} as const;
