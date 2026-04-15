import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { HTTP_CLIENT_DEFAULTS } from '@email-platform/foundation';
import { AppStoreSpyClient } from './appstorespy.client';
import {
  APPSTORESPY_CLIENT,
  APPSTORESPY_ENV,
  APPSTORESPY_LOG_CONTEXT,
} from './appstorespy-client.constants';

const clientProvider: Provider = {
  provide: APPSTORESPY_CLIENT,
  inject: [ConfigService, ClsService],
  useFactory: (config: ConfigService, cls: ClsService): AppStoreSpyClient =>
    new AppStoreSpyClient(
      cls,
      config.get<string>(APPSTORESPY_ENV.BASE_URL)!,
      HTTP_CLIENT_DEFAULTS.TIMEOUT_MS,
      {
        consecutiveThreshold: HTTP_CLIENT_DEFAULTS.CB_CONSECUTIVE_THRESHOLD,
        halfOpenAfterMs: HTTP_CLIENT_DEFAULTS.CB_HALF_OPEN_AFTER_MS,
      },
      APPSTORESPY_LOG_CONTEXT,
      config.get<string>(APPSTORESPY_ENV.API_KEY)!,
    ),
};

@Module({})
export class AppStoreSpyClientModule {
  static forRoot(): DynamicModule {
    return {
      module: AppStoreSpyClientModule,
      providers: [clientProvider],
      exports: [APPSTORESPY_CLIENT],
    };
  }
}
