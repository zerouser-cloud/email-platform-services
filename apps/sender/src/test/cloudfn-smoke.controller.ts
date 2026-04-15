import { Body, Controller, Inject, Post } from '@nestjs/common';
import { CloudFnTypes } from '@email-platform/contracts';
import { CloudFnClient } from '../infrastructure/clients/cloud-functions/cloudfn.client';
import { CLOUDFN_CLIENT } from '../infrastructure/clients/cloud-functions/cloudfn-client.constants';

const CLOUDFN_SMOKE = {
  ROUTE: 'test/cloudfn',
  SEND: 'send',
} as const;

@Controller(CLOUDFN_SMOKE.ROUTE)
export class CloudFnSmokeController {
  constructor(@Inject(CLOUDFN_CLIENT) private readonly client: CloudFnClient) {}

  @Post(CLOUDFN_SMOKE.SEND)
  async send(@Body() body: CloudFnTypes.SendEmailRequest): Promise<CloudFnTypes.SendEmailResponse> {
    return this.client.sendEmail(body);
  }
}
