import { Injectable } from '@nestjs/common';
import { AbstractHttpClient } from '@email-platform/foundation';
import { AppStoreSpyTypes } from '@email-platform/contracts';
import { APPSTORESPY_PATH, APPSTORESPY_QUERY } from './appstorespy-client.constants';

/**
 * AppStoreSpyClient — skeleton HTTP adapter (D-18).
 * Extends foundation AbstractHttpClient with its own CB instance (D-08).
 *
 * D-10: getAppMetadata is GET (idempotent by HTTP semantics) — default retry
 * policy applies (3 attempts on 5xx / network / timeout).
 */
@Injectable()
export class AppStoreSpyClient extends AbstractHttpClient {
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
