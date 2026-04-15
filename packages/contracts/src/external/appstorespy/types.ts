// AppStoreSpy HTTP API — skeleton types (Phase 24 D-18).
// Full vendor surface deferred to business-logic phase.
export interface LookupAppRequest {
  readonly appId: string;
  readonly country?: string;
}

export interface AppMetadata {
  readonly appId: string;
  readonly title: string;
  readonly developerEmail?: string;
}

export interface LookupAppResponse {
  readonly app: AppMetadata;
}
