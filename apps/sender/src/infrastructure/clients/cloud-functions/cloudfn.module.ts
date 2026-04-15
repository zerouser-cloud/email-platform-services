import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { HTTP_CLIENT_DEFAULTS } from '@email-platform/foundation';
import { CloudFnClient } from './cloudfn.client';
import {
  CLOUDFN_AUTH_HEADER_PREFIX,
  CLOUDFN_CLIENT,
  CLOUDFN_ENV,
  CLOUDFN_LOG_CONTEXT,
} from './cloudfn-client.constants';

const clientProvider: Provider = {
  provide: CLOUDFN_CLIENT,
  inject: [ConfigService, ClsService],
  useFactory: (config: ConfigService, cls: ClsService): CloudFnClient =>
    new CloudFnClient(
      cls,
      config.get<string>(CLOUDFN_ENV.BASE_URL)!,
      HTTP_CLIENT_DEFAULTS.TIMEOUT_MS,
      {
        consecutiveThreshold: HTTP_CLIENT_DEFAULTS.CB_CONSECUTIVE_THRESHOLD,
        halfOpenAfterMs: HTTP_CLIENT_DEFAULTS.CB_HALF_OPEN_AFTER_MS,
      },
      CLOUDFN_LOG_CONTEXT,
      `${CLOUDFN_AUTH_HEADER_PREFIX}${config.get<string>(CLOUDFN_ENV.API_KEY)!}`,
    ),
};

@Module({})
export class CloudFnClientModule {
  static forRoot(): DynamicModule {
    return {
      module: CloudFnClientModule,
      providers: [clientProvider],
      exports: [CLOUDFN_CLIENT],
    };
  }
}
