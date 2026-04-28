// Google Cloud Functions email-proxy — skeleton types (Phase 24 D-18).
// Full vendor surface deferred to business-logic phase.
export interface SendEmailRequest {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
  readonly from?: string;
}

export interface SendEmailResponse {
  readonly messageId: string;
  readonly acceptedAt: string; // ISO timestamp
}
