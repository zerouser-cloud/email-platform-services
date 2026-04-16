import { Injectable } from '@nestjs/common';
import { AbstractHttpClient, type HttpClientDeps } from '@email-platform/foundation';
import { AppStoreSpyTypes } from '@email-platform/contracts';
import {
  APPSTORESPY_AUTH_HEADER_NAME,
  APPSTORESPY_PATH,
  APPSTORESPY_QUERY,
} from './appstorespy-client.constants';

/**
 * AppStoreSpyClient — skeleton HTTP adapter (D-18).
 * Extends foundation AbstractHttpClient with its own CB instance (D-08).
 *
 * Auth: vendor uses custom `API-KEY` header (verified against legacy
 * implementation). URL contains no secret — safe to log.
 *
 * D-10: getAppMetadata is GET (idempotent by HTTP semantics) — default retry
 * policy applies (3 attempts on 5xx / network / timeout).
 */
@Injectable()
export class AppStoreSpyClient extends AbstractHttpClient {
  constructor(
    deps: HttpClientDeps,
    private readonly apiKey: string,
  ) {
    super(deps);
  }

  protected override buildAuthHeaders(): Record<string, string> {
    return { [APPSTORESPY_AUTH_HEADER_NAME]: this.apiKey };
  }

  getAppMetadata(
    req: AppStoreSpyTypes.LookupAppRequest,
  ): Promise<AppStoreSpyTypes.LookupAppResponse> {
    const params: Record<string, string> = { [APPSTORESPY_QUERY.APP_ID]: req.appId };
    if (req.country !== undefined) {
      params[APPSTORESPY_QUERY.COUNTRY] = req.country;
    }
    const query = new URLSearchParams(params).toString();
    return this.get<AppStoreSpyTypes.LookupAppResponse>(`${APPSTORESPY_PATH.LOOKUP_APP}?${query}`);
  }
}
