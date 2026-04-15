import { Body, Controller, Inject, Post } from '@nestjs/common';
import { AppStoreSpyTypes } from '@email-platform/contracts';
import { AppStoreSpyClient } from '../infrastructure/clients/appstorespy/appstorespy.client';
import { APPSTORESPY_CLIENT } from '../infrastructure/clients/appstorespy/appstorespy-client.constants';

const APPSTORESPY_SMOKE = {
  ROUTE: 'test/appstorespy',
  LOOKUP: 'lookup',
} as const;

@Controller(APPSTORESPY_SMOKE.ROUTE)
export class AppStoreSpySmokeController {
  constructor(@Inject(APPSTORESPY_CLIENT) private readonly client: AppStoreSpyClient) {}

  @Post(APPSTORESPY_SMOKE.LOOKUP)
  async lookup(
    @Body() body: AppStoreSpyTypes.LookupAppRequest,
  ): Promise<AppStoreSpyTypes.LookupAppResponse> {
    return this.client.getAppMetadata(body);
  }
}
