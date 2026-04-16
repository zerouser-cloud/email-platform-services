import { Module, type DynamicModule } from '@nestjs/common';
import { httpClientProvider } from '@email-platform/foundation';
import { AppStoreSpyClient } from './appstorespy.client';
import {
  APPSTORESPY_CLIENT,
  APPSTORESPY_ENV,
  APPSTORESPY_LOG_CONTEXT,
} from './appstorespy-client.constants';

@Module({})
export class AppStoreSpyClientModule {
  static forRoot(): DynamicModule {
    return {
      module: AppStoreSpyClientModule,
      providers: [
        httpClientProvider(
          {
            token: APPSTORESPY_CLIENT,
            logContext: APPSTORESPY_LOG_CONTEXT,
            baseUrlEnvKey: APPSTORESPY_ENV.BASE_URL,
          },
          (deps) =>
            new AppStoreSpyClient(deps, deps.config.getOrThrow<string>(APPSTORESPY_ENV.API_KEY)),
        ),
      ],
      exports: [APPSTORESPY_CLIENT],
    };
  }
}
