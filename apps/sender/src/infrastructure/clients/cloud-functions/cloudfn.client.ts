import { Injectable } from '@nestjs/common';
import { AbstractHttpClient, type HttpClientDeps } from '@email-platform/foundation';
import { CloudFnTypes } from '@email-platform/contracts';
import {
  CLOUDFN_AUTH_HEADER_NAME,
  CLOUDFN_AUTH_HEADER_VALUE_PREFIX,
  CLOUDFN_PATH,
} from './cloudfn-client.constants';

/**
 * CloudFnClient — skeleton HTTP adapter (D-18) for the Google Cloud Functions
 * email proxy. Extends foundation AbstractHttpClient with its own CB (D-08).
 *
 * Auth: standard Bearer token in Authorization header (GCP convention).
 * URL contains no secret — safe to log.
 *
 * D-10: sendEmail is POST WITHOUT `{ idempotent: true }` — mid-accept 5xx
 * retry risks duplicate send to the recipient. Callers opt in only when the
 * vendor supports an idempotency key.
 */
@Injectable()
export class CloudFnClient extends AbstractHttpClient {
  constructor(
    deps: HttpClientDeps,
    private readonly apiKey: string,
  ) {
    super(deps);
  }

  protected override buildAuthHeaders(): Record<string, string> {
    return {
      [CLOUDFN_AUTH_HEADER_NAME]: `${CLOUDFN_AUTH_HEADER_VALUE_PREFIX}${this.apiKey}`,
    };
  }

  sendEmail(req: CloudFnTypes.SendEmailRequest): Promise<CloudFnTypes.SendEmailResponse> {
    return this.post<CloudFnTypes.SendEmailResponse>(CLOUDFN_PATH.SEND_EMAIL, req);
  }
}
